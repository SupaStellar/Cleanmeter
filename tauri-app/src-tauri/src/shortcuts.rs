//! The app's global shortcuts, and the percentile-low recording run that one
//! of them scopes.
//!
//! Both shortcuts used to be `on_shortcut` calls with literal accelerators in
//! `lib.rs`. They are settings now, and Figma 2819:8960 puts both of them in
//! the same Settings card, which means something has to know what is
//! currently registered so it can take it back off the OS before putting the
//! next one on. That bookkeeping is this module.
//!
//! ## The recording run
//!
//! The 1% / 0.1% low figures are a rolling window of the last ~10s by
//! default, so they track what the game is doing now. They used to
//! accumulate from launch and never stop, which cannot report a recovery:
//! banked slow frames keep the entire 1% time budget until the fast run is
//! 99x longer, so a game capped at 60fps for 30s pinned the reading at 60 for
//! the next 49 minutes of 240fps play. See `FrameLowsWindow` in the sidecar.
//!
//! MSI Afterburner draws the same line, and its own documentation says where:
//! an unlimited buffer "is preferred if you manually start benchmarking
//! session with a hotkey", a rolling ring "if you permanently keep the
//! benchmark mode enabled". The overlay pill is the second case, the hotkey
//! is the first, so the key cycles between them:
//!
//!   Live       rolling window, the default — tracks the last few seconds
//!   Recording  clear and accumulate from zero, for the whole run
//!   Frozen     the run's final figure, held on the overlay to be read
//!
//! Three states on one key rather than two, because a benchmark result has to
//! survive being looked at (Recording -> Frozen) AND the user has to be able
//! to get back to a live number afterwards (Frozen -> Live). A two-state
//! toggle can do either one but not both.
//!
//! ONE key covers BOTH percentiles, which is why the binding lives in
//! Settings once (Figma 2819:8960, "Start/stop FPS lows recording") rather
//! than under each low in Stats. "1% low" and "0.1% low" are two queries
//! against one set of frametimes — which is exactly why 0.1% low is always
//! <= 1% low — so there is one run to start and stop, not one per reading.
//! Two independent runs would measure two different windows and could report
//! a 0.1% low ABOVE the 1% low, which is not a reading anybody can act on.
//!
//! State lives here rather than in the settings window's store because the
//! shortcut is global: it has to work with that window closed, and routing a
//! keypress out to a webview and back to decide what to send the sidecar
//! would make a hidden window part of the path.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;

use log::{info, warn};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::commands::PipeCommandSender;
use crate::pipe_client::PipeCommand;
use crate::types::OverlaySettings;

/// The settings field an action is stored under. Used as the key in the
/// `shortcut-status` payload so the frontend can line a failure up with the
/// field that produced it without a mapping table of its own.
impl ShortcutAction {
    fn settings_key(self) -> &'static str {
        match self {
            ShortcutAction::ToggleOverlay => "overlayShortcut",
            ShortcutAction::ToggleRecording => "recordingShortcut",
        }
    }
}

/// What a registered accelerator does when it fires.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ShortcutAction {
    /// Show/hide the HUD. Emitted to the webviews, which own the visibility.
    ToggleOverlay,
    /// Start/stop a percentile-low recording run, handled entirely here.
    ToggleRecording,
}

/// What the percentile lows are measuring. Mirrors the sidecar's `LowsMode`
/// (HardwareMonitor/PresentMon/LowsMode.cs); the discriminants ARE the pipe
/// payload, so they may not be reordered independently of it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LowsMode {
    /// A finished run, held on the overlay to be read.
    Frozen = 0,
    /// An explicitly started run: session-cumulative from the keypress.
    Recording = 1,
    /// The default. A rolling window of the last few seconds.
    Live = 2,
}

impl LowsMode {
    /// The pipe payload for this mode.
    pub fn wire(self) -> u8 {
        self as u8
    }

    /// The next mode the hotkey moves to: Live -> Recording -> Frozen -> Live.
    fn next(self) -> Self {
        match self {
            LowsMode::Live => LowsMode::Recording,
            LowsMode::Recording => LowsMode::Frozen,
            LowsMode::Frozen => LowsMode::Live,
        }
    }

    fn from_wire(v: u8) -> Self {
        match v {
            0 => LowsMode::Frozen,
            1 => LowsMode::Recording,
            // Live is the startup default, so an impossible value resolving
            // to it degrades to "the readings keep updating" rather than to a
            // silently frozen overlay.
            _ => LowsMode::Live,
        }
    }
}

/// What the lows are currently measuring, and which accelerator is
/// registered for each action. Named Registry, not State, because
/// `ShortcutState` is the plugin's own press/release enum.
pub struct ShortcutRegistry {
    /// The sidecar's current lows mode, as a `LowsMode` discriminant. Starts
    /// Live, which is the sidecar's own startup default — the two have to
    /// agree without anything being sent, because nothing is sent until the
    /// key is pressed.
    lows_mode: AtomicU8,
    /// Accelerator currently registered with the OS per action, so a change
    /// can unregister the right one. Absent = nothing registered.
    registered: Mutex<HashMap<ShortcutAction, String>>,
}

impl ShortcutRegistry {
    pub fn new() -> Self {
        ShortcutRegistry {
            lows_mode: AtomicU8::new(LowsMode::Live.wire()),
            registered: Mutex::new(HashMap::new()),
        }
    }

    pub fn lows_mode(&self) -> LowsMode {
        LowsMode::from_wire(self.lows_mode.load(Ordering::Relaxed))
    }
}

impl Default for ShortcutRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Advance the lows mode one step (Live -> Recording -> Frozen -> Live), tell
/// the sidecar, and tell the windows.
///
/// `fetch_update`, not load-then-store: the global-shortcut callback runs on
/// its own thread, and two presses landing close together would otherwise both
/// read the same value and send the same command twice, leaving the sidecar and
/// this state disagreeing about what is being measured. The CAS loop makes two
/// presses advance two steps.
///
/// `try_send` rather than `send`: that thread is not a Tokio context, so
/// awaiting is not available. The channel is 32 deep against a keypress, so a
/// full channel means the pipe writer is wedged — and dropping the toggle is
/// the right outcome then, since the sidecar would not act on it either.
pub fn toggle_recording(app: &AppHandle) {
    let Some(state) = app.try_state::<ShortcutRegistry>() else {
        return;
    };
    // Infallible: the closure always returns Some, so the Err arm is
    // unreachable and `unwrap_or` only satisfies the type.
    let was = state
        .lows_mode
        .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |v| {
            Some(LowsMode::from_wire(v).next().wire())
        })
        .unwrap_or(LowsMode::Live.wire());
    let previous = LowsMode::from_wire(was);
    let next = previous.next();

    if let Some(sender) = app.try_state::<PipeCommandSender>() {
        if let Err(e) = sender.0.try_send(PipeCommand::SetLowsMode(next.wire())) {
            // Put the mode back. `fetch_update` above has to happen first to
            // serialise two presses landing together, but a command the
            // sidecar never received must not leave this side believing the
            // mode changed: a dropped freeze would have us reporting "frozen"
            // while the sidecar kept publishing. The reconnect in pipe_client
            // re-asserts whatever this holds, so the value it holds has to
            // stay the truth.
            state.lows_mode.store(was, Ordering::Relaxed);
            warn!("Could not send the lows mode to the sidecar, reverting: {}", e);
            return;
        }
    }
    info!("Percentile-low mode {:?} -> {:?}", previous, next);
    // Emitted for the UI's benefit. Nothing renders it yet — the Figma card
    // shows the binding, not the run state — but the shortcut is global and a
    // user pressing it with the window open should not be looking at a window
    // that disagrees with the sidecar.
    let _ = app.emit(
        "recording-changed",
        match next {
            LowsMode::Live => "live",
            LowsMode::Recording => "recording",
            LowsMode::Frozen => "frozen",
        },
    );
}

/// Register both shortcuts from a settings snapshot.
///
/// The single entry point every caller uses — startup, a settings save, a
/// reset to defaults — so there is one place that knows the mapping from
/// settings field to action.
pub fn apply_all(app: &AppHandle, settings: &OverlaySettings) {
    let mut unavailable = HashMap::<&'static str, String>::new();
    for (action, accelerator) in [
        (ShortcutAction::ToggleOverlay, &settings.overlay_shortcut),
        (ShortcutAction::ToggleRecording, &settings.recording_shortcut),
    ] {
        if let Err(accel) = apply(app, action, accelerator) {
            unavailable.insert(action.settings_key(), accel);
        }
    }
    // Always emitted, including when empty, because it is the whole state and
    // not a notification: a field that failed and then succeeded has to be
    // told it succeeded, and a diff-free "here is what is currently broken"
    // is the only version of that which cannot get stuck showing a stale
    // warning.
    //
    // Registration fails for combos another application already owns —
    // RegisterHotKey answers ERROR_HOTKEY_ALREADY_REGISTERED and Windows
    // keeps giving the key to whoever asked first. Without this the field
    // would sit there showing a binding that does nothing at all.
    let _ = app.emit("shortcut-status", &unavailable);
}

/// Register `accelerator` for `action`, replacing whatever it had before. An
/// empty accelerator just unregisters.
///
/// Returns `Err(accelerator)` when the OS refused it — the caller reports
/// that to the UI rather than it being swallowed, but it is deliberately not
/// an error that stops the settings save which carried it: the user's choice
/// is still their choice, it just is not available on this machine.
pub fn apply(
    app: &AppHandle,
    action: ShortcutAction,
    accelerator: &str,
) -> Result<(), String> {
    let Some(state) = app.try_state::<ShortcutRegistry>() else {
        return Ok(());
    };
    let Ok(mut registered) = state.registered.lock() else {
        warn!("Shortcut registry lock poisoned; leaving the current bindings alone");
        return Ok(());
    };
    if registered.get(&action).map(String::as_str) == Some(accelerator) {
        return Ok(());
    }

    if let Some(previous) = registered.remove(&action) {
        // Only unregister if no OTHER action still holds the same
        // accelerator. Two actions can be bound to one combo — the fields do
        // not stop you — and unregistering here would silently take the key
        // away from whichever of them was not being edited.
        if !registered.values().any(|a| a == &previous) {
            if let Err(e) = app.global_shortcut().unregister(previous.as_str()) {
                warn!("Could not unregister the old {:?} shortcut {}: {}", action, previous, e);
            }
        }
    }

    if accelerator.is_empty() {
        info!("{:?} shortcut cleared", action);
        return Ok(());
    }

    let handle = app.clone();
    // Filter on Pressed: the callback fires on key-down AND key-up, so an
    // unfiltered handler runs the action twice per press — which for a toggle
    // means landing back where it started, and was a visible hide-then-show
    // flicker on the overlay before it was filtered.
    let result = app
        .global_shortcut()
        .on_shortcut(accelerator, move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            match action {
                ShortcutAction::ToggleOverlay => {
                    let _ = handle.emit("hotkey", "toggle-overlay");
                }
                ShortcutAction::ToggleRecording => toggle_recording(&handle),
            }
        });

    match result {
        Ok(()) => {
            registered.insert(action, accelerator.to_string());
            info!("{:?} shortcut registered: {}", action, accelerator);
            Ok(())
        }
        Err(e) => {
            warn!("Could not register the {:?} shortcut {}: {}", action, accelerator, e);
            Err(accelerator.to_string())
        }
    }
}

/// Hand every registered accelerator back to the OS for the duration of a
/// capture, then take them again.
///
/// Windows delivers a registered hotkey as WM_HOTKEY to the process that
/// registered it and does NOT pass it to the focused window. So while
/// Cleanmeter holds Ctrl+Alt+F10, pressing Ctrl+Alt+F10 inside Cleanmeter's
/// own settings window toggles the overlay and the webview never sees a
/// keydown — which makes an already-bound combo the one thing the shortcut
/// field cannot capture, including re-confirming the binding it is showing.
///
/// Only covers our own shortcuts. A combo another application owns (NVIDIA's
/// overlay holds Alt+F1/F2/F3/F9/F10 by default) still never reaches us, and
/// nothing here can change that.
pub fn set_capturing(app: &AppHandle, capturing: bool, settings: &OverlaySettings) {
    if !capturing {
        apply_all(app, settings);
        return;
    }
    let Some(state) = app.try_state::<ShortcutRegistry>() else {
        return;
    };
    let Ok(mut registered) = state.registered.lock() else {
        return;
    };
    for (action, accelerator) in registered.drain() {
        if let Err(e) = app.global_shortcut().unregister(accelerator.as_str()) {
            warn!("Could not release {:?} ({}) for capture: {}", action, accelerator, e);
        }
    }
    info!("Global shortcuts released for capture");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The hotkey is one key covering three states, so the cycle order IS the
    /// feature: a live reading you can start a run from, a run you can stop and
    /// read, and a way back to live. Any reordering strands one of them.
    #[test]
    fn the_hotkey_cycles_live_to_recording_to_frozen_and_back() {
        assert_eq!(LowsMode::Live.next(), LowsMode::Recording);
        assert_eq!(LowsMode::Recording.next(), LowsMode::Frozen);
        assert_eq!(LowsMode::Frozen.next(), LowsMode::Live);
    }

    /// Three presses return to where they started, so a user who taps the key
    /// without watching the overlay cannot end up somewhere unreachable.
    #[test]
    fn three_presses_return_to_the_starting_mode() {
        for start in [LowsMode::Live, LowsMode::Recording, LowsMode::Frozen] {
            assert_eq!(start.next().next().next(), start, "cycling from {:?}", start);
        }
    }

    /// A registry starts on the sidecar's own startup default. Nothing is sent
    /// until the key is pressed, so a mismatch here would make the first press
    /// send a mode the sidecar was already in and skip a step forever after.
    #[test]
    fn a_fresh_registry_agrees_with_the_sidecar_default() {
        assert_eq!(ShortcutRegistry::new().lows_mode(), LowsMode::Live);
    }

    /// An out-of-range byte resolves to Live rather than Frozen: the failure
    /// mode of guessing wrong is an overlay whose readings stop updating with
    /// nothing on screen to say why.
    #[test]
    fn an_unknown_wire_value_degrades_to_live() {
        assert_eq!(LowsMode::from_wire(0), LowsMode::Frozen);
        assert_eq!(LowsMode::from_wire(1), LowsMode::Recording);
        assert_eq!(LowsMode::from_wire(2), LowsMode::Live);
        for v in [3u8, 7, 255] {
            assert_eq!(LowsMode::from_wire(v), LowsMode::Live, "wire value {}", v);
        }
    }
}

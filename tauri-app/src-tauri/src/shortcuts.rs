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
//! The 1% / 0.1% low figures accumulate from launch and never stop — the
//! histogram in the sidecar's `PresentMonPoller` is cleared only when the
//! monitored app changes or the game has been gone for 30s. That is RTSS's
//! "unlimited" default and it stays the default here: nothing about the
//! numbers changes for anyone who never presses the key.
//!
//! What the key adds is MSI Afterburner's benchmark shape on top of it:
//!
//!   start  clear the histogram, accumulate from zero
//!   stop   compute the run's final figure and freeze it on the overlay
//!
//! ONE key covers BOTH percentiles, which is why the binding lives in
//! Settings once (Figma 2819:8960, "Start/stop FPS lows recording") rather
//! than under each low in Stats. "1% low" and "0.1% low" are two queries
//! against one frametime histogram — which is exactly why 0.1% low is always
//! <= 1% low — so there is one run to start and stop, not one per reading.
//! Two independent runs would measure two different windows and could report
//! a 0.1% low ABOVE the 1% low, which is not a reading anybody can act on.
//!
//! State lives here rather than in the settings window's store because the
//! shortcut is global: it has to work with that window closed, and routing a
//! keypress out to a webview and back to decide what to send the sidecar
//! would make a hidden window part of the path.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
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

/// Whether a run is currently accumulating, and which accelerator is
/// registered for each action. Named Registry, not State, because
/// `ShortcutState` is the plugin's own press/release enum.
pub struct ShortcutRegistry {
    /// True while the sidecar is accumulating. Starts true: that is the
    /// unbounded-from-launch behaviour the app already had.
    recording: AtomicBool,
    /// Accelerator currently registered with the OS per action, so a change
    /// can unregister the right one. Absent = nothing registered.
    registered: Mutex<HashMap<ShortcutAction, String>>,
}

impl ShortcutRegistry {
    pub fn new() -> Self {
        ShortcutRegistry {
            recording: AtomicBool::new(true),
            registered: Mutex::new(HashMap::new()),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.recording.load(Ordering::Relaxed)
    }
}

impl Default for ShortcutRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Flip the recording run on or off, tell the sidecar, and tell the windows.
///
/// `swap`, not load-then-store: the global-shortcut callback runs on its own
/// thread, and two presses landing close together would otherwise both read
/// the same value and send the same command twice, leaving the sidecar and
/// this flag disagreeing about whether a run is going.
///
/// `try_send` rather than `send`: that thread is not a Tokio context, so
/// awaiting is not available. The channel is 32 deep against a keypress, so a
/// full channel means the pipe writer is wedged — and dropping the toggle is
/// the right outcome then, since the sidecar would not act on it either.
pub fn toggle_recording(app: &AppHandle) {
    let Some(state) = app.try_state::<ShortcutRegistry>() else {
        return;
    };
    let was = state.recording.fetch_xor(true, Ordering::Relaxed);
    let next = !was;

    if let Some(sender) = app.try_state::<PipeCommandSender>() {
        if let Err(e) = sender.0.try_send(PipeCommand::SetLowsRecording(next)) {
            warn!("Could not send recording state to the sidecar: {}", e);
        }
    }
    info!("Percentile-low recording {}", if next { "started" } else { "stopped" });
    // Emitted for the UI's benefit. Nothing renders it yet — the Figma card
    // shows the binding, not the run state — but the shortcut is global and a
    // user pressing it with the window open should not be looking at a window
    // that disagrees with the sidecar.
    let _ = app.emit("recording-changed", next);
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


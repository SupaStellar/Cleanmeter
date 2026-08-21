use std::io::Write;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;

use crate::pipe_client::PipeCommand;
use crate::settings::SettingsManager;
use crate::types::{AppPreferences, MonitorInfo, OverlaySettings, SidecarStatus};

#[tauri::command]
pub fn ui_debug_log(msg: String) {
    let path = std::env::temp_dir().join("cleanmeter-ui.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(f, "[{}ms] {}", now_ms(), msg);
    }
}

/// Tear down the HardwareMonitor sidecar before an in-app update installs.
///
/// The sidecar (and PresentMon) keep `HardwareMonitor.exe` / `presentmon.exe`
/// open, and the supervisor in `lib.rs` respawns the sidecar within ~1s of it
/// dying — so the updater's NSIS installer failed with "Error opening file for
/// writing" when it tried to overwrite those files. Stop the supervisor first
/// (so it can't respawn), then kill the processes and wait briefly for Windows
/// to release the handles. Mirrors the Quit/exit teardown without exiting, so
/// the updater can replace the files and relaunch.
#[tauri::command]
pub async fn prepare_for_update(app: AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    // Stop the supervisor loop so it won't respawn the sidecar we're killing.
    if let Some(running) = app.try_state::<std::sync::Arc<AtomicBool>>() {
        running.store(false, Ordering::Relaxed);
    }
    #[cfg(windows)]
    {
        // taskkill + the handle-release wait block, so run them off the async
        // runtime and await completion before the installer starts.
        let app = app.clone();
        let _ = tauri::async_runtime::spawn_blocking(move || {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            // Kill the tracked child first (graceful), then any strays.
            if let Some(slot) = app
                .try_state::<std::sync::Arc<std::sync::Mutex<Option<std::process::Child>>>>()
            {
                if let Ok(mut guard) = slot.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
            for image in ["HardwareMonitor.exe", "presentmon.exe"] {
                let _ = std::process::Command::new("taskkill")
                    .args(["/f", "/im", image])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            }
            // Let the OS release the file handles before the installer overwrites.
            std::thread::sleep(std::time::Duration::from_millis(500));
        })
        .await;
    }
}

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub struct PipeCommandSender(pub mpsc::Sender<PipeCommand>);

/// Last sidecar status the supervisor published, kept so a webview that loads
/// after the first spawn or crash can still read it (events fired before its
/// listener existed are gone).
#[derive(Default)]
pub struct SidecarHealth(pub std::sync::Arc<std::sync::Mutex<SidecarStatus>>);

/// Read the supervisor's view of the sidecar. The banner needs this on mount to
/// tell a slow start from a broken one without waiting on a timer.
#[tauri::command]
pub fn get_sidecar_status(health: State<'_, SidecarHealth>) -> SidecarStatus {
    health.0.lock().unwrap().clone()
}

// ─── Settings Commands ──────────────────────────────────────────

#[tauri::command]
pub fn get_settings(settings_mgr: State<'_, SettingsManager>) -> OverlaySettings {
    settings_mgr.get_settings()
}

#[tauri::command]
pub fn save_settings(
    settings: OverlaySettings,
    settings_mgr: State<'_, SettingsManager>,
    app: AppHandle,
) {
    settings_mgr.save_settings(settings.clone());
    // Broadcast to every window, not just the overlay. The settings window
    // holds its own store copy; emitting only to the overlay left it with a
    // stale positionX/Y, so toggling a stat re-saved the old position and
    // snapped a dragged widget back. All windows now stay in sync with disk.
    let _ = app.emit("settings-changed", &settings);
}

#[tauri::command]
pub fn clear_settings(settings_mgr: State<'_, SettingsManager>, app: AppHandle) {
    settings_mgr.clear_settings();
    let defaults = settings_mgr.get_settings();
    let _ = app.emit("settings-changed", &defaults);
}

#[tauri::command]
pub fn get_preferences(settings_mgr: State<'_, SettingsManager>) -> AppPreferences {
    settings_mgr.get_preferences()
}

#[tauri::command]
pub fn save_preferences(prefs: AppPreferences, settings_mgr: State<'_, SettingsManager>) {
    settings_mgr.save_preferences(prefs);
}

// ─── Overlay Window Commands ────────────────────────────────────

/// Apply the overlay's click-through state. `interactive == false` is click-through:
/// tao sets `WS_EX_TRANSPARENT`, so hit-testing skips the overlay entirely and the
/// click lands on the game or desktop underneath.
///
/// Nothing persists this. The state is derived from settings-window visibility plus
/// process foreground (see `sync_overlay_interactive`), so no saved flag exists that
/// could strand the HUD somewhere the user can't undo — an older build shipped
/// `isPositionLocked`, and a stale `true` did exactly that.
///
/// Safe to call before the overlay has ever been shown, and a no-op at the OS level
/// when the flag already matches, since tao's `apply_diff` early-returns on an
/// empty flag diff.
pub fn apply_overlay_interactive(app: &AppHandle, interactive: bool) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_ignore_cursor_events(!interactive);
    }
}

/// True when the foreground window belongs to this process, i.e. the user is
/// interacting with Cleanmeter rather than with another application.
///
/// Deliberately process-wide rather than "is the settings window focused". Clicking
/// the HUD makes the *overlay* the foreground window — `WS_EX_NOACTIVATE` does not
/// prevent it, because WebView2's child HWND answers `WM_MOUSEACTIVATE` with
/// `MA_ACTIVATE` — which defocuses the settings window. Keying the gate on settings
/// focus alone therefore closed it on mouse-down and cut the drag off mid-gesture:
/// the interaction destroyed its own precondition. Asking "is any window of ours in
/// front" covers both the settings window and the overlay, so a drag completes.
#[cfg(windows)]
fn foreground_is_ours() -> bool {
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid != 0 && pid == GetCurrentProcessId()
    }
}

/// Non-Windows stub. Returning `false` leaves the overlay permanently click-through
/// off Windows, which is the honest answer: there is no foreground check implemented
/// there, and the app is Windows-only in every load-bearing part (requireAdministrator
/// manifest, the PawnIO driver, PresentMon, the HardwareMonitor sidecar). CI builds a
/// single `windows-latest` matrix entry, so a second real implementation here could
/// never be compiled or tested and would only rot.
#[cfg(not(windows))]
fn foreground_is_ours() -> bool {
    false
}

/// Bring a window to the front without letting tao fabricate a keystroke.
///
/// Use this instead of `WebviewWindow::set_focus()`. That call routes to tao's
/// `force_window_active`, which tries `SetForegroundWindow` and, when Windows refuses
/// it, synthesises a left-Alt press and release through `SendInput` to break the
/// foreground lock. The injection is system-wide, not scoped to our window: the
/// Alt-down is delivered to whoever is in front, and the Alt-up arrives after the
/// foreground has already moved to us, so the window that was in front can be left
/// believing Alt is still held. Every later keystroke there becomes Alt+key. For a HUD
/// that exists to sit next to games, with keys physically held down, that is not a
/// risk worth carrying for a focus nicety.
///
/// Windows refuses `SetForegroundWindow` exactly when we are not the foreground
/// process and did not receive the last input event, which is the normal state while
/// someone is playing. So the injecting branch is the in-game branch.
///
/// This mirrors tao's decision tree and its `SetForegroundWindow` attempt, so every
/// case that already worked behaves identically. Only the refused branch differs:
/// flash the taskbar button rather than forge input. The caller has already called
/// `show()`, so a refusal still leaves the window up, just not in front, which is the
/// same outcome the user gets today whenever the Alt hack fails to win the race.
#[cfg(windows)]
pub fn bring_to_front(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        FlashWindowEx, GetForegroundWindow, IsIconic, SetForegroundWindow, FLASHWINFO,
        FLASHWINFO_FLAGS, FLASHW_ALL, FLASHW_TIMERNOFG,
    };

    // tauri's HWND comes from its own (newer) windows crate; both are a newtype over
    // *mut c_void, so the pointer carries across.
    let Ok(raw) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(raw.0 as _);

    unsafe {
        // Mirrors tao: a minimized window is left alone. Read through IsIconic rather
        // than Tauri's is_minimized() so this cannot race a queued window message.
        if IsIconic(hwnd).as_bool() {
            return;
        }
        if hwnd == GetForegroundWindow() {
            return;
        }
        if SetForegroundWindow(hwnd).as_bool() {
            return;
        }

        // Refused. Signal instead of forcing. FLASHW_TIMERNOFG stops the flashing by
        // itself once the window is brought forward, so nothing has to clear it.
        let info = FLASHWINFO {
            cbSize: std::mem::size_of::<FLASHWINFO>() as u32,
            hwnd,
            dwFlags: FLASHWINFO_FLAGS(FLASHW_ALL.0 | FLASHW_TIMERNOFG.0),
            uCount: 3,
            dwTimeout: 0,
        };
        let _ = FlashWindowEx(&info);
    }
}

/// Non-Windows stub. `set_focus` only injects input in tao's Windows backend, so
/// everywhere else the plain call is already the right one.
#[cfg(not(windows))]
pub fn bring_to_front(window: &tauri::WebviewWindow) {
    let _ = window.set_focus();
}

/// Recompute the gate from live window state and apply it.
///
/// The overlay accepts mouse input only while the settings window is visible *and*
/// Cleanmeter is the app in front — the one moment the user can be positioning it.
/// Requiring foreground and not mere visibility means Settings left open behind a
/// game still leaves the HUD click-through.
///
/// Deriving it here, rather than trusting whichever `Focused` event fired last,
/// makes the state self-correcting. A launch where the settings window is shown but
/// never wins foreground (autostart at logon, or another app grabbing focus first)
/// would otherwise leave the overlay eating clicks until the user's next focus
/// change; this settles it within one heartbeat.
pub fn sync_overlay_interactive(app: &AppHandle) {
    let settings_shown = app
        .get_webview_window("settings")
        .map(|w| w.is_visible().unwrap_or(false))
        .unwrap_or(false);
    apply_overlay_interactive(app, settings_shown && foreground_is_ours());
}

#[tauri::command]
pub fn set_overlay_visible(visible: bool, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if visible {
            let _ = overlay.show();
            let _ = overlay.set_always_on_top(true);
            // The overlay is created hidden and first shown on initial sensor
            // data, which can land after the gate was already decided. Recompute
            // so it never comes up interactive while Settings is unfocused.
            sync_overlay_interactive(&app);
        } else {
            let _ = overlay.hide();
        }
    }
}

#[tauri::command]
pub fn set_overlay_position(x: i32, y: i32, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(x, y)));
    }
}

#[tauri::command]
pub fn set_overlay_size(width: u32, height: u32, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_size(tauri::Size::Physical(tauri::PhysicalSize::new(width, height)));
    }
}

#[tauri::command]
pub fn set_overlay_opacity(opacity: f64, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        // Tauri 2 doesn't have set_opacity directly on WebviewWindow,
        // so we'll send it to the frontend to apply via CSS
        let _ = overlay.emit("set-opacity", opacity);
    }
}

// ─── Pipe Commands ──────────────────────────────────────────────

#[tauri::command]
pub async fn select_present_mon_app(
    app_name: String,
    sender: State<'_, PipeCommandSender>,
) -> Result<(), String> {
    sender
        .0
        .send(PipeCommand::SelectPresentMonApp(app_name))
        .await
        .map_err(|e| format!("Failed to send command: {}", e))
}

#[tauri::command]
pub async fn refresh_present_mon_apps(
    sender: State<'_, PipeCommandSender>,
) -> Result<(), String> {
    sender
        .0
        .send(PipeCommand::RefreshPresentMonApps)
        .await
        .map_err(|e| format!("Failed to send command: {}", e))
}

#[tauri::command]
pub async fn set_polling_rate(
    interval_ms: u16,
    sender: State<'_, PipeCommandSender>,
) -> Result<(), String> {
    sender
        .0
        .send(PipeCommand::SelectPollingRate(interval_ms))
        .await
        .map_err(|e| format!("Failed to send command: {}", e))
}

// ─── System Commands ────────────────────────────────────────────

// Autostart via a Scheduled Task rather than the HKCU Run key. The exe is
// manifested requireAdministrator, and Windows can't silently auto-launch an
// elevation-required exe from Run — it prompts UAC at every logon. A task with
// "/rl highest" launches it elevated with no prompt.
#[cfg(windows)]
const AUTOSTART_TASK: &str = "CleanMeter";

#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Always clear the legacy Run entry — leaving it would keep prompting
        // UAC at logon (and double-launch alongside the task).
        {
            use winreg::enums::*;
            use winreg::RegKey;
            if let Ok(run_key) = RegKey::predef(HKEY_CURRENT_USER)
                .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_WRITE)
            {
                let _ = run_key.delete_value("CleanMeter");
            }
        }

        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            // /sc onlogon fires at sign-in, /rl highest runs elevated without a
            // prompt, /f overwrites an existing task. Quote the path for spaces.
            // Capture output so a failure surfaces schtasks' actual stderr in
            // the Err (and never leaks to the parent console).
            let output = std::process::Command::new("schtasks")
                .args([
                    "/create",
                    "/tn",
                    AUTOSTART_TASK,
                    "/tr",
                    &format!("\"{}\"", exe.to_string_lossy()),
                    "/sc",
                    "onlogon",
                    "/rl",
                    "highest",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| e.to_string())?;
            if !output.status.success() {
                return Err(format!(
                    "schtasks /create exited with {:?}: {}",
                    output.status.code(),
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
        } else {
            // Deleting a non-existent task prints an expected error — silence it.
            let _ = std::process::Command::new("schtasks")
                .args(["/delete", "/tn", AUTOSTART_TASK, "/f"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_auto_start() -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Task present ⇒ autostart on. Silence stdout/stderr — this runs on
        // every startup + settings load, and a missing task (the default for
        // most users) would otherwise spam "cannot find the file specified".
        if let Ok(status) = std::process::Command::new("schtasks")
            .args(["/query", "/tn", AUTOSTART_TASK])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status()
        {
            if status.success() {
                return true;
            }
        }
        // Fall back to the legacy Run entry so installs that predate the task
        // migration still report correctly until the next toggle migrates them.
        use winreg::enums::*;
        use winreg::RegKey;
        if let Ok(run_key) = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_READ)
        {
            return run_key.get_value::<String, _>("CleanMeter").is_ok();
        }
    }
    false
}

#[tauri::command]
pub fn check_dotnet_runtime() -> bool {
    match std::process::Command::new("dotnet")
        .arg("--list-runtimes")
        .output()
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains("Microsoft.NETCore.App 8.")
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub fn get_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let Some(window) = app.get_webview_window("settings") else {
        return vec![];
    };
    let monitors = window.available_monitors().unwrap_or_default();
    let primary = window.primary_monitor().ok().flatten();
    let primary_name = primary.as_ref().and_then(|m| m.name()).map(|s| s.to_string());

    monitors
        .into_iter()
        .map(|m| {
            let name = m.name().map(|s| s.to_string()).unwrap_or_default();
            let size = m.size();
            let pos = m.position();
            let is_primary = primary_name.as_deref() == Some(name.as_str());
            MonitorInfo {
                name: if is_primary {
                    format!("{} (Primary)", name)
                } else {
                    name
                },
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                primary: is_primary,
            }
        })
        .collect()
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn grant_admin_consent(settings_mgr: State<'_, SettingsManager>) {
    let mut prefs = settings_mgr.get_preferences();
    prefs.admin_consent = true;
    settings_mgr.save_preferences(prefs);
}

#[derive(serde::Deserialize)]
pub struct FeedbackInput {
    pub name: String,
    pub message: String,
    #[serde(rename = "attachmentPath")]
    pub attachment_path: Option<String>,
}

// POSTs feedback to the portal. URL + write key are injected at build time via
// option_env!; if either is missing (e.g. a plain local dev build) the command
// returns an error instead of attempting a request. Touches no app state.
//
// Strip a leading UTF-8 BOM and surrounding whitespace from the injected
// values: secrets set via `gh secret set` from a BOM-encoded source (the
// PowerShell default) otherwise bake the BOM into the string, which makes the
// URL unparseable and the write-key header wrong. Trimming keeps the binary
// resilient to that class of mistake.
fn injected(value: Option<&'static str>) -> Option<&'static str> {
    value
        .map(|s| s.trim_start_matches('\u{feff}').trim())
        .filter(|s| !s.is_empty())
}

#[tauri::command]
pub async fn submit_feedback(input: FeedbackInput) -> Result<(), String> {
    let portal = injected(option_env!("FEEDBACK_PORTAL_URL")).ok_or("feedback portal not configured")?;
    let key = injected(option_env!("FEEDBACK_WRITE_KEY")).ok_or("feedback key not configured")?;

    let mut form = reqwest::multipart::Form::new()
        .text("name", input.name)
        .text("message", input.message)
        .text("app_version", env!("CARGO_PKG_VERSION"))
        .text("os", std::env::consts::OS);

    if let Some(path) = input.attachment_path.as_deref() {
        let bytes = tokio::fs::read(path)
            .await
            .map_err(|e| format!("read attachment: {e}"))?;
        let file_path = std::path::Path::new(path);
        let filename = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("attachment")
            .to_string();
        // The portal validates the part's content type against an image
        // allowlist; reqwest defaults to application/octet-stream, so the
        // mime must be set explicitly (extensions per pickImageAttachment).
        let mime = match file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .as_deref()
        {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("webp") => "image/webp",
            Some("gif") => "image/gif",
            // The portal would reject anything else anyway (opaque 400);
            // fail fast with an actionable message instead.
            _ => return Err("attachment must be a png, jpg, webp, or gif image".to_string()),
        };
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(filename)
            .mime_str(mime)
            .map_err(|e| format!("attachment mime: {e}"))?;
        form = form.part("attachment", part);
    }

    let resp = reqwest::Client::new()
        .post(format!("{portal}/api/feedback"))
        .header("x-feedback-key", key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("portal returned {}", resp.status()))
    }
}

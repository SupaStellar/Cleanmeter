use std::io::Write;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::mpsc;

use crate::pipe_client::PipeCommand;
use crate::settings::SettingsManager;
use crate::types::{AppPreferences, MonitorInfo, OverlaySettings};

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

fn now_ms() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub struct PipeCommandSender(pub mpsc::Sender<PipeCommand>);

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

#[tauri::command]
pub fn set_overlay_visible(visible: bool, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if visible {
            let _ = overlay.show();
            let _ = overlay.set_always_on_top(true);
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
pub fn set_overlay_click_through(enabled: bool, app: AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_ignore_cursor_events(enabled);
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

#[tauri::command]
pub fn launch_hardware_monitor(app: AppHandle) -> Result<(), String> {
    // Find HardwareMonitor.exe relative to the app's resource directory
    let exe_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|p| p.join("HardwareMonitor.exe"))
        .filter(|p| p.exists())
        // Fallback: look next to the tauri exe in dev
        .or_else(|| {
            std::env::current_exe().ok().and_then(|exe| {
                // Walk up to find the publish folder
                let candidates = [
                    exe.parent()?.join("HardwareMonitor.exe"),
                ];
                candidates.into_iter().find(|p| p.exists())
            })
        })
        // Final fallback: hardcoded dev path
        .unwrap_or_else(|| {
            std::path::PathBuf::from(
                r"C:\Users\alimm\cleanmeter\HardwareMonitor\HardwareMonitor\bin\Release\net8.0\win-x64\publish\HardwareMonitor.exe"
            )
        });

    let exe_str = exe_path.to_string_lossy().to_string();

    // Write a PowerShell script to a temp file, then execute it elevated.
    // This installs HardwareMonitor as a Windows Service (runs as SYSTEM with
    // full hardware access for LibreHardwareMonitor sensor readings).
    let script = format!(
        "$exe = '{}'\n\
         $svc = Get-Service -Name 'CleanMeterHW' -ErrorAction SilentlyContinue\n\
         if (-not $svc) {{ New-Service -Name 'CleanMeterHW' -BinaryPathName ('\"' + $exe + '\"') -DisplayName 'Cleanmeter Hardware Monitor' -StartupType Automatic }}\n\
         $svc = Get-Service -Name 'CleanMeterHW' -ErrorAction SilentlyContinue\n\
         if ($svc.Status -ne 'Running') {{ Start-Service 'CleanMeterHW' }}",
        exe_str.replace('\'', "''")
    );

    let script_path = std::env::temp_dir().join("cleanmeter_hw_setup.ps1");
    std::fs::write(&script_path, &script)
        .map_err(|e| format!("Failed to write setup script: {}", e))?;

    let script_str = script_path.to_string_lossy().to_string();
    std::process::Command::new("powershell")
        .args([
            "-WindowStyle", "Hidden",
            "-Command",
            &format!("Start-Process powershell -Verb RunAs -ArgumentList '-ExecutionPolicy Bypass -File \"{}\"'", script_str),
        ])
        .spawn()
        .map_err(|e| format!("Failed to launch elevated setup: {}", e))?;

    Ok(())
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

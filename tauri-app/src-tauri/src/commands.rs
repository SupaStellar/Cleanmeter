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
    // Notify overlay window of settings change
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.emit("settings-changed", &settings);
    }
}

#[tauri::command]
pub fn clear_settings(settings_mgr: State<'_, SettingsManager>, app: AppHandle) {
    settings_mgr.clear_settings();
    let defaults = settings_mgr.get_settings();
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.emit("settings-changed", &defaults);
    }
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

#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let run_key = hkcu
            .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_WRITE)
            .map_err(|e| e.to_string())?;

        if enabled {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            run_key
                .set_value("CleanMeter", &exe.to_string_lossy().to_string())
                .map_err(|e| e.to_string())?;
        } else {
            let _ = run_key.delete_value("CleanMeter");
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_auto_start() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(run_key) = hkcu.open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_READ,
        ) {
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
         if (-not $svc) {{ New-Service -Name 'CleanMeterHW' -BinaryPathName $exe -DisplayName 'CleanMeter Hardware Monitor' -StartupType Automatic }}\n\
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

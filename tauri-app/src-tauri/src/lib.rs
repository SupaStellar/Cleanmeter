mod commands;
mod pipe_client;
mod settings;
mod tray;
mod types;

use commands::PipeCommandSender;
use log::info;
use settings::SettingsManager;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::mpsc;

#[cfg(windows)]
fn is_elevated() -> bool {
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut size = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut size,
        );
        ok.is_ok() && elevation.TokenIsElevated != 0
    }
}

#[cfg(windows)]
fn relaunch_as_admin() {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
    use windows::Win32::Foundation::HWND;

    let exe = std::env::current_exe().expect("failed to get exe path");
    let exe_wide: Vec<u16> = exe.to_string_lossy().encode_utf16().chain(std::iter::once(0)).collect();
    let verb: Vec<u16> = "runas\0".encode_utf16().collect();
    unsafe {
        ShellExecuteW(
            HWND::default(),
            PCWSTR(verb.as_ptr()),
            PCWSTR(exe_wide.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOW,
        );
    }
    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Self-elevate on Windows if not already running as admin
    #[cfg(windows)]
    if !is_elevated() {
        relaunch_as_admin();
        return;
    }

    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing settings window when a second instance launches
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            info!("CleanMeter starting up...");

            // Initialize settings manager
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let settings_mgr = SettingsManager::new(app_data_dir);
            app.manage(settings_mgr);

            // Set up pipe client communication channel
            let (cmd_tx, cmd_rx) = mpsc::channel::<pipe_client::PipeCommand>(32);
            app.manage(PipeCommandSender(cmd_tx));

            // Start the pipe client in a background task
            let app_handle = app.handle().clone();
            let running = Arc::new(AtomicBool::new(true));
            let running_clone = running.clone();

            tauri::async_runtime::spawn(async move {
                pipe_client::run_pipe_client(app_handle, cmd_rx, running_clone).await;
            });

            // Store running flag for cleanup
            app.manage(running);

            // Set up system tray
            tray::setup_tray(app.handle())?;

            // Spawn HardwareMonitor as a child process.
            // Kill any existing instances first to avoid pipe conflicts.
            // Since CleanMeter runs as admin (requireAdministrator manifest),
            // the child inherits those privileges and can read all hardware sensors.
            {
                let hw_exe = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.join("HardwareMonitor.exe")))
                    .unwrap_or_else(|| std::path::PathBuf::from("HardwareMonitor.exe"));
                #[cfg(windows)]
                {
                    use std::os::windows::process::CommandExt;
                    // Remove the old Windows service (if installed by a previous version)
                    let _ = std::process::Command::new("sc.exe")
                        .args(["stop", "CleanMeterHW"])
                        .creation_flags(0x08000000)
                        .status();
                    let _ = std::process::Command::new("sc.exe")
                        .args(["delete", "CleanMeterHW"])
                        .creation_flags(0x08000000)
                        .status();
                    // Kill any existing HardwareMonitor instances before spawning a new one
                    let _ = std::process::Command::new("taskkill")
                        .args(["/f", "/im", "HardwareMonitor.exe"])
                        .creation_flags(0x08000000)
                        .status();
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    if let Ok(child) = std::process::Command::new(hw_exe)
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .spawn()
                    {
                        app.manage(std::sync::Mutex::new(Some(child)));
                    }
                }
            }

            // Register global shortcuts
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            let app_handle = app.handle().clone();

            app.global_shortcut().on_shortcut("Ctrl+F10", move |_app, _shortcut, _event| {
                let _ = app_handle.emit("hotkey", "toggle-overlay");
            })?;

            let app_handle2 = app.handle().clone();
            app.global_shortcut().on_shortcut("Alt+F11", move |_app, _shortcut, _event| {
                let _ = app_handle2.emit("hotkey", "toggle-recording");
            })?;

            // Periodically reassert overlay always-on-top so games can't push it behind.
            // Only reasserts when overlay is currently visible (user hasn't hidden it).
            {
                let app_handle_top = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        if let Some(overlay) = app_handle_top.get_webview_window("overlay") {
                            if overlay.is_visible().unwrap_or(false) {
                                let _ = overlay.set_always_on_top(true);
                            }
                        }
                    }
                });
            }

            // Handle settings window close → minimize to tray
            let app_handle3 = app.handle().clone();
            if let Some(settings_window) = app.get_webview_window("settings") {
                settings_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(window) = app_handle3.get_webview_window("settings") {
                            let _ = window.hide();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::clear_settings,
            commands::get_preferences,
            commands::save_preferences,
            commands::set_overlay_visible,
            commands::set_overlay_position,
            commands::set_overlay_size,
            commands::set_overlay_click_through,
            commands::set_overlay_opacity,
            commands::select_present_mon_app,
            commands::refresh_present_mon_apps,
            commands::set_polling_rate,
            commands::check_dotnet_runtime,
            commands::get_monitors,
            commands::get_app_version,
            commands::grant_admin_consent,
            commands::launch_hardware_monitor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

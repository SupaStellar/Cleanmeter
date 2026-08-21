use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconEvent,
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show_settings", "Show Settings", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle_overlay", "Toggle Overlay", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "─────────────", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &toggle, &separator, &quit])?;

    let tray = app.tray_by_id("main").unwrap_or_else(|| {
        tauri::tray::TrayIconBuilder::with_id("main")
            .menu(&menu)
            .build(app)
            .expect("Failed to build tray icon")
    });

    tray.set_menu(Some(menu))?;

    tray.on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            ..
        } = event
        {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.show();
                crate::commands::bring_to_front(&window);
            }
        }
    });

    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "show_settings" => {
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.show();
                crate::commands::bring_to_front(&window);
            }
        }
        "toggle_overlay" => {
            let _ = app.emit("hotkey", "toggle-overlay");
        }
        "quit" => {
            // Kill HardwareMonitor child process
            if let Some(mutex) = app.try_state::<std::sync::Mutex<Option<std::process::Child>>>() {
                if let Ok(mut guard) = mutex.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
            // Also kill any orphaned HardwareMonitor/PresentMon processes
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                let _ = std::process::Command::new("taskkill")
                    .args(["/f", "/im", "HardwareMonitor.exe"])
                    .creation_flags(0x08000000)
                    .status();
                let _ = std::process::Command::new("taskkill")
                    .args(["/f", "/im", "presentmon.exe"])
                    .creation_flags(0x08000000)
                    .status();
            }
            app.exit(0);
        }
        _ => {}
    });

    Ok(())
}

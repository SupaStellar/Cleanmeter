mod commands;
mod pipe_client;
mod shortcuts;
mod settings;
mod tray;
mod types;

use commands::{PipeCommandSender, SidecarHealth};
use log::{error, info, warn};
use settings::SettingsManager;
use types::SidecarStatus;
use std::sync::atomic::{AtomicBool, Ordering};
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

/// True when the PawnIO kernel driver service is registered on this machine.
/// PawnIO replaced WinRing0 upstream (LHM 0.9.6); LibreHardwareMonitor needs it
/// present to read MSR/SuperIO sensors (CPU temperature/power, board voltages).
#[cfg(windows)]
fn pawnio_service_present() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    std::process::Command::new("sc.exe")
        .args(["query", "PawnIO"])
        .creation_flags(CREATE_NO_WINDOW)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Whether a process with this image name is running. `None` means the snapshot
/// could not be taken, i.e. we cannot tell.
///
/// Takes a name rather than hardcoding one so the mechanism itself is testable:
/// a probe that silently answers "nothing is running" would disable the cleanup
/// below without any visible failure.
#[cfg(windows)]
fn process_running(image_name: &str) -> Option<bool> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut found = false;
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                if String::from_utf16_lossy(&entry.szExeFile[..len])
                    .eq_ignore_ascii_case(image_name)
                {
                    found = true;
                    break;
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
        Some(found)
    }
}

/// True when a HardwareMonitor we do not own is already running: one orphaned by
/// a crashed run, or the instance the legacy CleanMeterHW service hosts. Only
/// called before the first spawn, when we own no child, so anything found is
/// foreign.
///
/// Checking the process rather than the named pipe matters. The sidecar creates
/// its pipe only after LibreHardwareMonitor finishes enumerating (measured up to
/// 13.7s), so an orphan still inside that window holds no pipe and a pipe probe
/// misses it entirely. Nothing later corrects that: a second sidecar creates its
/// own instance of the same pipe name rather than failing
/// (`NamedPipeServerStream.MaxAllowedServerInstances` in PipeHost.cs), so
/// neither process exits, the respawn loop below never iterates, and the
/// duplicate keeps polling ring0 and driving PresentMon for the rest of the
/// session. Unlike a `taskkill`, this costs no process spawn.
///
/// Fails safe: if the snapshot cannot be taken we assume one is running, which
/// restores the old unconditional cleanup.
#[cfg(windows)]
fn foreign_sidecar_running() -> bool {
    process_running("HardwareMonitor.exe").unwrap_or_else(|| {
        warn!("Could not enumerate processes; assuming a stale sidecar is present");
        true
    })
}

#[cfg(all(test, windows))]
mod process_probe_tests {
    use super::process_running;

    /// The probe's whole value is answering "yes" when something really is
    /// running; a mechanism that always answered "no" would silently disable the
    /// stale-instance cleanup. The test binary is the one process guaranteed to
    /// be running while this test runs.
    #[test]
    fn finds_a_process_that_is_definitely_running() {
        let me = std::env::current_exe().expect("current exe");
        let name = me.file_name().expect("file name").to_string_lossy().into_owned();
        assert_eq!(process_running(&name), Some(true), "probing for {}", name);
    }

    #[test]
    fn does_not_find_a_process_that_cannot_exist() {
        assert_eq!(
            process_running("cleanmeter-no-such-process.exe"),
            Some(false)
        );
    }

    /// Windows image names are case-insensitive; the supervisor hardcodes one
    /// spelling and the running process may differ.
    #[test]
    fn matches_regardless_of_case() {
        let me = std::env::current_exe().expect("current exe");
        let name = me.file_name().expect("file name").to_string_lossy().to_uppercase();
        assert_eq!(process_running(&name), Some(true));
    }
}

/// Drop the CleanMeterHW service, which hosts a second copy of the sidecar.
///
/// The app supervises its own sidecar now, so a service-hosted one is a
/// duplicate: both poll ring0 and both drive PresentMon. Nothing in the app
/// creates the service any more — the admin-consent screen used to install it
/// through a `launch_hardware_monitor` command, which this build removes — so
/// this is now purely a migration that cleans up installs made by older
/// versions.
///
/// Runs once per launch (the caller's flag is loop-local), off the startup path.
#[cfg(windows)]
fn remove_legacy_service() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    for args in [["stop", "CleanMeterHW"], ["delete", "CleanMeterHW"]] {
        let _ = std::process::Command::new("sc.exe")
            .args(args)
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
}

/// Install the PawnIO driver from the bundled signed installer if it is not
/// already present. Uses `-install -silent` so the installer does not pop its
/// "PawnIO Setup" window on first launch — Cleanmeter installs it in the
/// background, unlike LibreHardwareMonitor's own user-initiated `-install` where
/// a window is acceptable. Best-effort: any failure is logged and swallowed so
/// startup is never blocked. A missing driver only costs the ring0 sensors
/// (which the sidecar already degrades gracefully around), exactly as when
/// WinRing0 was quarantined by Defender.
#[cfg(windows)]
fn ensure_pawnio_installed(setup_path: &std::path::Path) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    if pawnio_service_present() {
        info!("PawnIO driver already installed");
        return;
    }
    if !setup_path.exists() {
        warn!(
            "PawnIO installer not found at {}; low-level sensors may be unavailable",
            setup_path.display()
        );
        return;
    }
    info!("PawnIO driver not found; installing from {}", setup_path.display());
    match std::process::Command::new(setup_path)
        .args(["-install", "-silent"])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
    {
        Ok(status) if status.success() => info!("PawnIO driver installed"),
        Ok(status) => warn!(
            "PawnIO installer exited with {:?}; continuing without low-level sensors",
            status.code()
        ),
        Err(e) => warn!(
            "Failed to run PawnIO installer: {}; continuing without low-level sensors",
            e
        ),
    }
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the existing settings window when a second instance launches
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.show();
                commands::bring_to_front(&window);
            }
        }))
        .setup(|app| {
            info!("Cleanmeter starting up...");

            // Initialize the settings manager early so startup can read the
            // start_minimized preference before deciding whether to show the
            // settings window.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            let settings_mgr = SettingsManager::new(app_data_dir);
            let start_minimized = settings_mgr.get_preferences().start_minimized;
            app.manage(settings_mgr);

            // One-time autostart migration: older builds registered autostart
            // via an HKCU Run entry, which prompts UAC at every logon for this
            // requireAdministrator exe. Move it to a scheduled task (launches
            // elevated silently) and drop the Run entry.
            #[cfg(windows)]
            {
                use winreg::enums::*;
                use winreg::RegKey;
                let has_run_entry = RegKey::predef(HKEY_CURRENT_USER)
                    .open_subkey_with_flags(
                        r"Software\Microsoft\Windows\CurrentVersion\Run",
                        KEY_READ,
                    )
                    .ok()
                    .and_then(|k| k.get_value::<String, _>("CleanMeter").ok())
                    .is_some();
                if has_run_entry {
                    let _ = commands::set_auto_start(true);
                }
            }

            // Force the settings window to spec size, centered on the primary
            // monitor in physical pixels. Done in Rust so it lands correctly
            // before the window is ever shown — Tauri's `center: true` config
            // and JS-side `center()` were both being overridden by Windows
            // restoring a stale position from prior runs.
            if let Some(window) = app.get_webview_window("settings") {
                let monitor = window.primary_monitor().ok().flatten();

                if let Some(m) = monitor {
                    let m_size = m.size();
                    let m_pos = m.position();
                    let scale = m.scale_factor();

                    let want_w: f64 = 651.0;
                    let mut want_h: f64 = 900.0;
                    let monitor_logical_h = m_size.height as f64 / scale;
                    if want_h > monitor_logical_h - 80.0 {
                        want_h = (monitor_logical_h - 80.0).max(400.0);
                    }

                    let _ = window.set_size(tauri::Size::Logical(
                        tauri::LogicalSize::new(want_w, want_h),
                    ));

                    let phys_w = (want_w * scale) as i32;
                    let phys_h = (want_h * scale) as i32;
                    let x = m_pos.x + (m_size.width as i32 - phys_w) / 2;
                    let y = m_pos.y + (m_size.height as i32 - phys_h) / 2;

                    let _ = window.set_position(tauri::Position::Physical(
                        tauri::PhysicalPosition::new(x, y),
                    ));
                } else {
                    let _ = window.set_size(tauri::Size::Logical(
                        tauri::LogicalSize::new(651.0, 900.0),
                    ));
                    let _ = window.center();
                }
                // Honor "Start minimized": when on, leave the settings window
                // hidden (config is visible:false) so the app starts to tray.
                if !start_minimized {
                    let _ = window.show();
                    commands::bring_to_front(&window);
                }
            }

            // Set up pipe client communication channel
            let (cmd_tx, cmd_rx) = mpsc::channel::<pipe_client::PipeCommand>(32);
            app.manage(PipeCommandSender(cmd_tx));
            // Managed before the shortcut below is applied: apply_shortcut
            // reads this state to know what to unregister.
            app.manage(shortcuts::ShortcutRegistry::new());

            // Start the pipe client in a background task
            let app_handle = app.handle().clone();
            let running = Arc::new(AtomicBool::new(true));
            let running_clone = running.clone();
            let running_for_hw = running.clone();

            tauri::async_runtime::spawn(async move {
                pipe_client::run_pipe_client(app_handle, cmd_rx, running_clone).await;
            });

            // Store running flag for cleanup
            app.manage(running);

            // Set up system tray
            tray::setup_tray(app.handle())?;

            // Supervise HardwareMonitor as a child process. Spawning it once was
            // fragile: if a stale instance still held the named pipe at launch
            // (or the child crashed), it exited and was never replaced — which
            // surfaced as a permanent "Pipe not connected" with no recovery short
            // of a manual restart. This loop respawns the sidecar whenever it
            // dies, so a startup race or a crash self-heals within ~1s. The live
            // child is tracked so app exit can kill it instead of orphaning it
            // (an orphaned sidecar is what created the stale-pipe race to begin
            // with). Cleanmeter runs elevated (requireAdministrator manifest), so
            // the child inherits admin and can read every sensor + drive PresentMon.
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                use std::process::Child;
                use std::sync::Mutex as StdMutex;

                const CREATE_NO_WINDOW: u32 = 0x08000000;

                // In a packaged build the sidecar is bundled as a Tauri resource,
                // so resolve via resource_dir() first. Fall back to the executable's
                // own directory for `cargo tauri dev`, where the .exe sits next to
                // the freshly built binary rather than under a resource dir.
                let hw_exe = app
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|p| p.join("HardwareMonitor.exe"))
                    .filter(|p| p.exists())
                    .or_else(|| {
                        std::env::current_exe()
                            .ok()
                            .and_then(|p| p.parent().map(|d| d.join("HardwareMonitor.exe")))
                    })
                    .unwrap_or_else(|| std::path::PathBuf::from("HardwareMonitor.exe"));

                // The PawnIO installer is bundled beside the sidecar as a Tauri
                // resource; resolve it the same way so first-launch driver setup
                // works in packaged builds and falls back for `cargo tauri dev`.
                let pawnio_setup = app
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|p| p.join("PawnIO_setup.exe"))
                    .filter(|p| p.exists())
                    .or_else(|| {
                        std::env::current_exe()
                            .ok()
                            .and_then(|p| p.parent().map(|d| d.join("PawnIO_setup.exe")))
                    })
                    .unwrap_or_else(|| std::path::PathBuf::from("PawnIO_setup.exe"));

                let child_slot: Arc<StdMutex<Option<Child>>> = Arc::new(StdMutex::new(None));
                app.manage(child_slot.clone());

                // Sidecar health is both pushed and pollable. The settings
                // webview registers its listener only once it has loaded, which
                // is easily after the first spawn (or a first crash), so an
                // event alone would be missed and the banner would run on stale
                // zeroes. `get_sidecar_status` lets it read the current value on
                // mount; the event keeps it current afterwards.
                let health = SidecarHealth::default();
                let health_for_thread = health.0.clone();
                app.manage(health);
                let app_for_hw = app.handle().clone();
                let publish = move |status: SidecarStatus| {
                    *health_for_thread.lock().unwrap() = status.clone();
                    let _ = app_for_hw.emit("sidecar-status", status);
                };

                let hw_running = running_for_hw;
                std::thread::spawn(move || {
                    // Ensure the PawnIO driver is present before the sidecar
                    // reads sensors. PawnIO replaced WinRing0 upstream; without
                    // it, LibreHardwareMonitor cannot read MSR/SuperIO sensors.
                    // Non-blocking and best-effort (see ensure_pawnio_installed).
                    ensure_pawnio_installed(&pawnio_setup);

                    // Clear a stale instance only when one is actually there.
                    // This used to run unconditionally: two `sc.exe` calls, a
                    // `taskkill`, and a flat 500ms sleep in front of every
                    // launch, all to handle a case that only arises after a
                    // crash. The sidecar is the long pole in startup (its
                    // hardware enumeration measured 1.55s median and up to
                    // 13.7s across 114 launches, and no overlay can appear
                    // before it finishes), so nothing else belongs ahead of it.
                    if foreign_sidecar_running() {
                        warn!("A HardwareMonitor is already running; clearing it before spawning");
                        let _ = std::process::Command::new("taskkill")
                            .args(["/f", "/im", "HardwareMonitor.exe"])
                            .creation_flags(CREATE_NO_WINDOW)
                            .status();
                        // Let the OS release the pipe handle held by whatever we
                        // just killed before the first spawn tries to bind it.
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }

                    let mut legacy_service_checked = false;
                    let mut exits: u32 = 0;

                    while hw_running.load(Ordering::Relaxed) {
                        match std::process::Command::new(&hw_exe)
                            .creation_flags(CREATE_NO_WINDOW)
                            .spawn()
                        {
                            Ok(child) => {
                                info!("HardwareMonitor spawned (pid {})", child.id());
                                *child_slot.lock().unwrap() = Some(child);
                                // Alive: clears any previous spawn error, so a
                                // failure that recovers stops being reported.
                                publish(SidecarStatus { exits, spawn_error: None });

                                // Retire the service-hosted duplicate, on its own
                                // thread so two `sc.exe` calls cannot delay the
                                // sidecar we just started. Stopping it does not
                                // disturb this child: two sidecars can serve the
                                // same pipe name concurrently, so ours is already
                                // running either way (see foreign_sidecar_running).
                                if !legacy_service_checked {
                                    legacy_service_checked = true;
                                    std::thread::spawn(remove_legacy_service);
                                }

                                // Poll for exit so we can also react to shutdown.
                                loop {
                                    if !hw_running.load(Ordering::Relaxed) {
                                        let mut guard = child_slot.lock().unwrap();
                                        if let Some(c) = guard.as_mut() {
                                            let _ = c.kill();
                                        }
                                        *guard = None;
                                        info!("HardwareMonitor supervisor stopped");
                                        return;
                                    }
                                    let exited = match child_slot.lock().unwrap().as_mut() {
                                        Some(c) => matches!(c.try_wait(), Ok(Some(_)) | Err(_)),
                                        None => true,
                                    };
                                    if exited {
                                        break;
                                    }
                                    std::thread::sleep(std::time::Duration::from_millis(500));
                                }
                                *child_slot.lock().unwrap() = None;
                                exits = exits.saturating_add(1);
                                publish(SidecarStatus { exits, spawn_error: None });
                            }
                            Err(e) => {
                                error!("Failed to spawn HardwareMonitor: {}", e);
                                publish(SidecarStatus {
                                    exits,
                                    spawn_error: Some(e.to_string()),
                                });
                            }
                        }

                        if !hw_running.load(Ordering::Relaxed) {
                            break;
                        }
                        // Backoff before respawn: keeps a hard-failing sidecar from
                        // busy-looping and lets the OS release the pipe from the
                        // instance that just exited.
                        warn!("HardwareMonitor exited; respawning in 1s");
                        std::thread::sleep(std::time::Duration::from_secs(1));
                    }
                    info!("HardwareMonitor supervisor stopped");
                });
            }

            // Register the global shortcuts from settings. Both accelerators
            // are configurable now (Settings → Shortcuts for the overlay
            // toggle, Stats → 1% Low for recording), so neither is registered
            // inline here: shortcuts::apply_all is also what save_settings
            // calls, which keeps one place knowing what is bound to what.
            {
                let stored = app.state::<SettingsManager>().get_settings();
                shortcuts::apply_all(&app.handle().clone(), &stored);
            }

            // Periodically reassert overlay always-on-top so games can't push it behind.
            // Only reasserts when overlay is currently visible (user hasn't hidden it).
            // The click-through gate is recomputed on the same tick, which is what
            // makes it self-correcting rather than dependent on having seen every
            // Focused event. Both calls are no-ops at the OS level when nothing
            // changed (tao's apply_diff early-returns on an empty flag diff).
            {
                let app_handle_top = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                        if let Some(overlay) = app_handle_top.get_webview_window("overlay") {
                            if overlay.is_visible().unwrap_or(false) {
                                let _ = overlay.set_always_on_top(true);
                                commands::sync_overlay_interactive(&app_handle_top);
                            }
                        }
                    }
                });
            }

            // Handle settings window close → minimize to tray,
            // and convert native maximize (double-click) into "full height"
            // so the window never actually fullscreens.
            //
            // This handler also drives the overlay's click-through gate. The gate is
            // never stored, only derived: the overlay accepts mouse input while the
            // settings window is visible AND Cleanmeter is the app in front. See
            // commands::sync_overlay_interactive for why it is process-wide foreground
            // rather than settings-window focus. Requiring foreground means Settings
            // left open behind a game still leaves the HUD click-through.
            if let Some(settings_window) = app.get_webview_window("settings") {
                let app_handle3 = app.handle().clone();
                let w_for_event = settings_window.clone();
                settings_window.on_window_event(move |event| {
                    match event {
                        // Recompute rather than trusting the event's boolean. A
                        // Focused(false) here can mean "the user switched to their
                        // game" (close the gate) or "the user pressed the mouse on
                        // the HUD, which activated the overlay" (keep it open, a
                        // drag just started). sync_overlay_interactive tells those
                        // apart by asking whether any window of ours is in front.
                        tauri::WindowEvent::Focused(_) => {
                            commands::sync_overlay_interactive(&app_handle3);
                        }
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            api.prevent_close();
                            if let Some(window) = app_handle3.get_webview_window("settings") {
                                let _ = window.hide();
                            }
                            // hide() is not guaranteed to emit Focused(false), so
                            // close the gate explicitly on the hide-to-tray path.
                            //
                            // Force it to false rather than calling
                            // sync_overlay_interactive: that reads is_visible(), a
                            // window_getter! that blocks until the event loop replies,
                            // and this handler runs while the loop is already blocked
                            // on the prevent_close channel. apply_overlay_interactive
                            // only sends one-way messages, so it cannot wedge the
                            // close. The 500ms heartbeat reconciles the value anyway,
                            // so forcing it here cannot leave a wrong state behind.
                            commands::apply_overlay_interactive(&app_handle3, false);
                        }
                        tauri::WindowEvent::Resized(_) => {
                            if w_for_event.is_maximized().unwrap_or(false) {
                                let _ = w_for_event.unmaximize();
                                // Snap to full monitor height (minus taskbar) at 651 wide
                                if let Ok(Some(m)) = w_for_event.current_monitor() {
                                    let scale = m.scale_factor();
                                    let m_size = m.size();
                                    let m_pos = m.position();
                                    let target_w: f64 = 651.0;
                                    let target_h: f64 = (m_size.height as f64 / scale) - 40.0;
                                    let _ = w_for_event.set_size(tauri::Size::Logical(
                                        tauri::LogicalSize::new(target_w, target_h.max(400.0)),
                                    ));
                                    let phys_w = (target_w * scale) as i32;
                                    let x = m_pos.x
                                        + (m_size.width as i32 - phys_w) / 2;
                                    let y = m_pos.y + (20.0 * scale) as i32;
                                    let _ = w_for_event.set_position(tauri::Position::Physical(
                                        tauri::PhysicalPosition::new(x, y),
                                    ));
                                }
                            }
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::clear_settings,
            commands::set_shortcut_capturing,
            commands::get_sidecar_status,
            commands::get_preferences,
            commands::save_preferences,
            commands::set_overlay_visible,
            commands::set_overlay_position,
            commands::set_overlay_size,
            commands::set_overlay_opacity,
            commands::select_present_mon_app,
            commands::refresh_present_mon_apps,
            commands::set_polling_rate,
            commands::check_dotnet_runtime,
            commands::set_auto_start,
            commands::get_auto_start,
            commands::get_monitors,
            commands::get_app_version,
            commands::grant_admin_consent,
            commands::ui_debug_log,
            commands::submit_feedback,
            commands::prepare_for_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // On real teardown, stop the supervisor and kill the sidecar so it
            // never lingers to hold the pipe against the next launch.
            if let tauri::RunEvent::Exit = event {
                if let Some(running) = app_handle.try_state::<Arc<AtomicBool>>() {
                    running.store(false, Ordering::Relaxed);
                }
                #[cfg(windows)]
                if let Some(slot) =
                    app_handle.try_state::<Arc<std::sync::Mutex<Option<std::process::Child>>>>()
                {
                    if let Ok(mut guard) = slot.lock() {
                        if let Some(child) = guard.as_mut() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}

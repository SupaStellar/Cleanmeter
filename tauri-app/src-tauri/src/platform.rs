use serde::Serialize;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: &'static str,
    pub display_backend: &'static str,
    pub can_position_overlay: bool,
    pub global_shortcuts: bool,
    pub percentile_lows: bool,
    pub can_auto_update: bool,
    pub shortcut_descriptions: std::collections::HashMap<String, String>,
}
#[cfg(target_os = "linux")]
static WAYLAND: std::sync::OnceLock<bool> = std::sync::OnceLock::new();

/// Resolve GTK's actual choice once on the main thread, before choosing plugins.
#[cfg(target_os = "linux")]
pub fn initialize_display() -> Result<(), String> {
    use gtk::prelude::*;
    gtk::init().map_err(|error| error.to_string())?;
    let display = gtk::gdk::Display::default().ok_or("GTK did not open a display")?;
    let _ = WAYLAND.set(display.type_().name() == "GdkWaylandDisplay");
    Ok(())
}

pub fn native_wayland() -> bool {
    #[cfg(target_os = "linux")]
    { WAYLAND.get().copied().unwrap_or(false) }
    #[cfg(not(target_os = "linux"))]
    { false }
}
#[tauri::command]
pub fn get_platform_info() -> PlatformInfo {
    let wayland = native_wayland();
    PlatformInfo {
        os: std::env::consts::OS,
        display_backend: if cfg!(target_os = "linux") {
            if wayland {
                "wayland"
            } else {
                "x11"
            }
        } else {
            "native"
        },
        can_position_overlay: !wayland || layer_overlay(),
        global_shortcuts: !wayland || portal_shortcuts(),
        percentile_lows: cfg!(any(windows, target_os = "linux")),
        can_auto_update: cfg!(windows) || (cfg!(target_os = "linux") && std::env::var_os("APPIMAGE").is_some()),
        shortcut_descriptions: shortcut_descriptions(),
    }
}

fn layer_overlay() -> bool {
    #[cfg(target_os = "linux")]
    { crate::linux_overlay::active() }
    #[cfg(not(target_os = "linux"))]
    { false }
}

fn portal_shortcuts() -> bool {
    #[cfg(target_os = "linux")]
    { crate::linux_shortcuts::available() }
    #[cfg(not(target_os = "linux"))]
    { false }
}

fn shortcut_descriptions() -> std::collections::HashMap<String, String> {
    #[cfg(target_os = "linux")]
    { crate::linux_shortcuts::labels() }
    #[cfg(not(target_os = "linux"))]
    { std::collections::HashMap::new() }
}

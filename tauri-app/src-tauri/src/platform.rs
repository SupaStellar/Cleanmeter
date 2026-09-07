use serde::Serialize;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: &'static str,
    pub display_backend: &'static str,
    pub can_position_overlay: bool,
    pub global_shortcuts: bool,
    pub percentile_lows: bool,
}
pub fn native_wayland() -> bool {
    cfg!(target_os = "linux")
        && std::env::var("GDK_BACKEND")
            .map(|s| s == "wayland")
            .unwrap_or_else(|_| {
                std::env::var_os("DISPLAY").is_none()
                    && std::env::var_os("WAYLAND_DISPLAY").is_some()
            })
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
        can_position_overlay: !wayland,
        global_shortcuts: !wayland,
        percentile_lows: cfg!(windows),
    }
}

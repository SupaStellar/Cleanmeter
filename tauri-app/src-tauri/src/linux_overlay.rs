//! Native Wayland layer surface. GTK operations stay on the application thread.
use gtk::prelude::*;
use gtk_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Manager};

static ACTIVE: AtomicBool = AtomicBool::new(false);
pub fn active() -> bool { ACTIVE.load(Ordering::Relaxed) }

pub fn setup(app: &AppHandle) -> bool {
    if !crate::platform::native_wayland() || !gtk_layer_shell::is_supported() { return false; }
    let Some(overlay) = app.get_webview_window("overlay") else { return false; };
    let Ok(window) = overlay.gtk_window() else { return false; };
    window.hide();
    if window.is_realized() { window.unrealize(); }
    window.init_layer_shell();
    window.set_namespace("cleanmeter-overlay");
    window.set_layer(Layer::Overlay);
    window.set_keyboard_mode(KeyboardMode::None);
    window.set_exclusive_zone(-1);
    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Left, true);
    ACTIVE.store(true, Ordering::Relaxed);
    log::info!("Wayland layer-shell overlay enabled");
    true
}

pub fn position(app: &AppHandle, x: i32, y: i32) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        let Some(overlay) = handle.get_webview_window("overlay") else { return; };
        let Ok(window) = overlay.gtk_window() else { return; };
        let Some(display) = gtk::gdk::Display::default() else { return; };
        let selected = handle.state::<crate::settings::SettingsManager>().get_settings().selected_display_index as usize;
        let monitors = overlay.available_monitors().unwrap_or_default();
        let index = if selected < monitors.len() { selected } else { 0 };
        let Some(monitor) = display.monitor(index as i32) else { return; };
        let (left, top, scale) = monitors.get(index)
            .map(|m| (m.position().x, m.position().y, m.scale_factor()))
            .unwrap_or((0, 0, monitor.scale_factor() as f64));
        window.set_monitor(&monitor);
        window.set_layer_shell_margin(Edge::Left, ((x - left) as f64 / scale).round().max(0.0) as i32);
        window.set_layer_shell_margin(Edge::Top, ((y - top) as f64 / scale).round().max(0.0) as i32);
    });
}

pub fn interactive(app: &AppHandle, interactive: bool) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(overlay) = handle.get_webview_window("overlay") {
            if let Ok(window) = overlay.gtk_window() {
                if let Some(surface) = window.window() {
                    if interactive { surface.input_shape_combine_region(&gtk::cairo::Region::create_rectangle(&gtk::cairo::RectangleInt::new(0, 0, surface.width(), surface.height())), 0, 0); }
                    else { surface.input_shape_combine_region(&gtk::cairo::Region::create(), 0, 0); }
                }
            }
        }
    });
}

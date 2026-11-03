//! Desktop-mediated shortcuts for native Wayland. The desktop owns consent.
use ashpd::desktop::global_shortcuts::{GlobalShortcuts, NewShortcut};
use futures_util::StreamExt;
use std::sync::{OnceLock, Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

static AVAILABLE: AtomicBool = AtomicBool::new(false);
static LABELS: Mutex<Option<std::collections::HashMap<String, String>>> = Mutex::new(None);
pub fn labels() -> std::collections::HashMap<String, String> { LABELS.lock().ok().and_then(|v| v.clone()).unwrap_or_default() }
static CAPTURING: AtomicBool = AtomicBool::new(false);
static UPDATES: OnceLock<watch::Sender<[String; 2]>> = OnceLock::new();
pub fn available() -> bool { AVAILABLE.load(Ordering::Relaxed) }
pub fn capturing(value: bool) { CAPTURING.store(value, Ordering::Relaxed); }

pub fn apply(app: &AppHandle, settings: &crate::types::OverlaySettings) {
    let requested = [settings.overlay_shortcut.clone(), settings.recording_shortcut.clone()];
    let tx = UPDATES.get_or_init(|| {
        let (tx, mut rx) = watch::channel(requested.clone());
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            loop {
                let bindings = rx.borrow_and_update().clone();
                if let Err(error) = session(&app, &bindings, &mut rx).await {
                    log::warn!("Global Shortcuts portal: {error}");
                    if let Ok(mut labels) = LABELS.lock() { *labels = None; }
                    let _ = app.emit("platform-info", crate::platform::get_platform_info());
                    let failed: std::collections::HashMap<_, _> = ["overlayShortcut", "recordingShortcut"]
                        .into_iter().zip(bindings).filter(|(_, value)| !value.is_empty()).collect();
                    let _ = app.emit("shortcut-status", failed);
                    if rx.changed().await.is_err() { break; }
                }
            }
        });
        tx
    });
    tx.send_if_modified(|current| {
        if *current == requested { false } else { *current = requested; true }
    });
}

async fn session(app: &AppHandle, bindings: &[String; 2], updates: &mut watch::Receiver<[String; 2]>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let portal = tokio::time::timeout(std::time::Duration::from_secs(5), GlobalShortcuts::new()).await??;
    AVAILABLE.store(true, Ordering::Relaxed);
    let _ = app.emit("platform-info", crate::platform::get_platform_info());
    let session = tokio::time::timeout(std::time::Duration::from_secs(10), portal.create_session(Default::default())).await??;
    let session_path: String = serde_json::from_value(serde_json::to_value(&session)?)?;
    let result = async {
        let shortcuts: Vec<_> = ["overlay", "recording"].into_iter()
            .zip(["Show/hide overlay", "Start/stop FPS lows recording"])
            .zip(bindings).filter(|(_, trigger)| !trigger.is_empty())
            .map(|((id, description), trigger)| NewShortcut::new(id, description).preferred_trigger(crate::linux_shortcut_trigger::trigger(trigger).as_str()))
            .collect();
        let mut activated = portal.receive_activated().await?;
        let mut closed = session.receive_closed().await?;
        let mut changed = portal.receive_shortcuts_changed().await?;
        let response = tokio::select! {
            result = tokio::time::timeout(std::time::Duration::from_secs(120), portal.bind_shortcuts(&session, &shortcuts, None, Default::default())) => result??.response()?,
            _ = updates.changed() => return Ok(()),
        };
        let descriptions: std::collections::HashMap<_, _> = response.shortcuts().iter()
            .map(|s| (s.id().to_owned(), s.trigger_description().to_owned())).collect();
        log::info!("Global Shortcuts portal bound {} actions", descriptions.len());
        if let Ok(mut labels) = LABELS.lock() { *labels = Some(descriptions); }
        let _ = app.emit("platform-info", crate::platform::get_platform_info());
        let _ = app.emit("shortcut-status", std::collections::HashMap::<String, String>::new());
        loop {
            tokio::select! {
                _ = updates.changed() => break,
                _ = closed.next() => return Err("desktop closed the shortcut session".into()),
                event = changed.next() => {
                    let Some(event) = event else { return Err("shortcut change stream closed".into()); };
                    if event.session_handle().as_str() != session_path { continue; }
                    let descriptions = event.shortcuts().iter().map(|s| (s.id().to_owned(), s.trigger_description().to_owned())).collect();
                    if let Ok(mut labels) = LABELS.lock() { *labels = Some(descriptions); }
                    let _ = app.emit("platform-info", crate::platform::get_platform_info());
                }
                event = activated.next() => {
                    let Some(event) = event else { return Err("shortcut event stream closed".into()); };
                    if event.session_handle().as_str() != session_path || CAPTURING.load(Ordering::Relaxed) { continue; }
                    match event.shortcut_id() {
                        "overlay" if !bindings[0].is_empty() => { let _ = app.emit("hotkey", "toggle-overlay"); }
                        "recording" if !bindings[1].is_empty() => crate::shortcuts::toggle_recording(app),
                        _ => {}
                    }
                }
            }
        }
        Ok::<_, Box<dyn std::error::Error + Send + Sync>>(())
    }.await;
    let _ = session.close().await;
    result
}

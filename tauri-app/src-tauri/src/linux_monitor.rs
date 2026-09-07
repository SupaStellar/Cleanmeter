use crate::{
    commands::SidecarHealth,
    linux_fps,
    linux_sensors::{append_nvidia, sensor, LinuxSensors},
    pipe_client::PipeCommand,
    types::{Hardware, HardwareType, PipeStatus, SensorType, SidecarStatus},
};
use std::{
    io::Read,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

/// Bound driver-tool latency: a stuck NVIDIA driver must not stall CPU/RAM.
fn nvidia() -> String {
    use std::process::{Command, Stdio};
    let Ok(mut child)=Command::new("nvidia-smi").args(["--query-gpu=uuid,name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw","--format=csv,noheader,nounits"]).stdout(Stdio::piped()).stderr(Stdio::null()).spawn() else {return String::new()};
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut out = String::new();
                if status.success() {
                    if let Some(stdout) = child.stdout.take() {
                        let _ = stdout.take(32768).read_to_string(&mut out);
                    }
                }
                return out;
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return String::new();
            }
            _ => {}
        }
        if start.elapsed() > Duration::from_millis(750) {
            let _ = child.kill();
            let _ = child.wait();
            return String::new();
        }
        std::thread::sleep(Duration::from_millis(10));
    }
}

pub fn run(
    app: AppHandle,
    mut commands: mpsc::Receiver<PipeCommand>,
    running: Arc<AtomicBool>,
    polling: u64,
    target: String,
) {
    let mut reader = LinuxSensors::default();
    let mut interval = Duration::from_millis(polling.clamp(100, 5000));
    let mut target = target;
    let fps_dir = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("cleanmeter/fps");
    let mut previous = Instant::now();
    let mut next = Instant::now();
    let mut nv_next = Instant::now();
    let mut nv = String::new();
    let mut connected = false;
    let mut last_apps = vec![];
    let mut apps_next = Instant::now();
    while running.load(Ordering::Relaxed) {
        while let Ok(command) = commands.try_recv() {
            match command {
                PipeCommand::SelectPollingRate(ms) => {
                    interval = Duration::from_millis(u64::from(ms).clamp(100, 5000));
                    next = Instant::now();
                }
                PipeCommand::SelectPresentMonApp(app) => {
                    target = if app == "Auto" { String::new() } else { app }
                }
                PipeCommand::RefreshPresentMonApps => {
                    apps_next = Instant::now();
                    next = Instant::now();
                }
                PipeCommand::SetLowsMode(_) => {}
            }
        }
        if Instant::now() < next {
            std::thread::sleep(Duration::from_millis(20));
            continue;
        }
        let now = Instant::now();
        let elapsed = now.duration_since(previous);
        match reader.sample(Path::new("/proc"), Path::new("/sys"), elapsed) {
            Ok(mut data) => {
                // Rates span successful snapshots, including any failed polls.
                previous = now;
                if now >= nv_next {
                    nv = nvidia();
                    nv_next = Instant::now() + Duration::from_secs(1);
                }
                append_nvidia(&mut data, &nv);
                let samples = linux_fps::samples(&fps_dir);
                let mut apps: Vec<_> = samples.iter().map(|s| s.app.clone()).collect();
                apps.sort();
                apps.dedup();
                // Webviews may subscribe after the first poll. Replay the list
                // and connection status periodically even if nothing changed.
                if apps != last_apps || now >= apps_next {
                    let _ = app.emit("present-mon-apps", &apps);
                    let _ = app.emit("pipe-status", PipeStatus { connected: true });
                    last_apps = apps;
                    apps_next = now + Duration::from_secs(2);
                }
                let chosen = if target.is_empty() || target == "Auto" {
                    samples.first()
                } else {
                    samples.iter().find(|s| s.app == target)
                };
                if let Some(s) = chosen {
                    let id = "/linux/fps";
                    data.hardwares.push(Hardware {
                        identifier: id.into(),
                        name: format!("MangoHud: {}", s.app),
                        hardware_type: HardwareType::Unknown,
                    });
                    if let Some(v) = sensor(
                        id,
                        "presented",
                        "Presented Frames",
                        SensorType::Frequency,
                        s.fps as f64,
                    ) {
                        data.sensors.push(v);
                    }
                    if let Some(v) = sensor(
                        id,
                        "frametime",
                        "Frametime",
                        SensorType::TimeSpan,
                        s.frametime as f64,
                    ) {
                        data.sensors.push(v);
                    }
                }
                if !connected {
                    log::info!(
                        "Linux monitoring connected ({} sensors)",
                        data.sensors.len()
                    );
                    let _ = app.emit("pipe-status", PipeStatus { connected: true });
                    connected = true;
                }
                if let Some(h) = app.try_state::<SidecarHealth>() {
                    let mut health = h.0.lock().unwrap();
                    if health.spawn_error.take().is_some() {
                        let _ = app.emit("sidecar-status", health.clone());
                    }
                }
                let _ = app.emit("sensor-data", data);
            }
            Err(error) => {
                if connected {
                    let _ = app.emit("pipe-status", PipeStatus { connected: false });
                    connected = false;
                }
                let status = SidecarStatus {
                    exits: 0,
                    spawn_error: Some(error),
                };
                if let Some(h) = app.try_state::<SidecarHealth>() {
                    *h.0.lock().unwrap() = status.clone();
                }
                let _ = app.emit("sidecar-status", status);
            }
        }
        next = now + interval;
    }
    let _ = app.emit("pipe-status", PipeStatus { connected: false });
}

/// Useful for driver troubleshooting and an end-to-end Linux smoke test.
pub fn diagnostics() -> Result<(), String> {
    let mut reader = LinuxSensors::default();
    reader.sample(Path::new("/proc"), Path::new("/sys"), Duration::ZERO)?;
    let start = Instant::now();
    std::thread::sleep(Duration::from_millis(250));
    let mut data = reader.sample(Path::new("/proc"), Path::new("/sys"), start.elapsed())?;
    append_nvidia(&mut data, &nvidia());
    let dir = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("cleanmeter/fps");
    let games: Vec<_> = linux_fps::samples(&dir)
        .iter()
        .map(|s| {
            serde_json::json!({
                "app": s.app, "fps": s.fps, "frametime": s.frametime
            })
        })
        .collect();
    let output = serde_json::json!({ "hardware": data, "games": games });
    println!(
        "{}",
        serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?
    );
    Ok(())
}

use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use log::{error, info, warn};
use std::io::{self, Cursor, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::types::*;

/// Events parsed from the pipe read thread
enum ParsedEvent {
    SensorData(HardwareMonitorData),
    PresentMonApps(Vec<String>),
}

/// Messages the frontend can send to the pipe client
#[derive(Debug)]
pub enum PipeCommand {
    RefreshPresentMonApps,
    SelectPresentMonApp(String),
    SelectPollingRate(u16),
}

/// Parse a Data packet (command 0) from raw bytes
fn parse_data_packet(data: &[u8]) -> Result<HardwareMonitorData, String> {
    let mut cursor = Cursor::new(data);

    let hw_count = cursor
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("Failed to read hw_count: {}", e))?;
    let sensor_count = cursor
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("Failed to read sensor_count: {}", e))?;

    let mut hardwares = Vec::with_capacity(hw_count as usize);
    for _ in 0..hw_count {
        let name_len = cursor
            .read_u16::<LittleEndian>()
            .map_err(|e| format!("hw name_len: {}", e))? as usize;
        let id_len = cursor
            .read_u16::<LittleEndian>()
            .map_err(|e| format!("hw id_len: {}", e))? as usize;

        let mut name_buf = vec![0u8; name_len];
        cursor
            .read_exact(&mut name_buf)
            .map_err(|e| format!("hw name: {}", e))?;
        let name = String::from_utf8_lossy(&name_buf)
            .trim_end_matches('\0')
            .to_string();

        let mut id_buf = vec![0u8; id_len];
        cursor
            .read_exact(&mut id_buf)
            .map_err(|e| format!("hw id: {}", e))?;
        let identifier = String::from_utf8_lossy(&id_buf)
            .trim_end_matches('\0')
            .to_string();

        let hw_type_raw = cursor
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("hw type: {}", e))?;

        hardwares.push(Hardware {
            name,
            identifier,
            hardware_type: HardwareType::from(hw_type_raw),
        });
    }

    let mut sensors = Vec::with_capacity(sensor_count as usize);
    for _ in 0..sensor_count {
        let name_len = cursor
            .read_u16::<LittleEndian>()
            .map_err(|e| format!("sensor name_len: {}", e))? as usize;
        let id_len = cursor
            .read_u16::<LittleEndian>()
            .map_err(|e| format!("sensor id_len: {}", e))? as usize;
        let hw_id_len = cursor
            .read_u16::<LittleEndian>()
            .map_err(|e| format!("sensor hw_id_len: {}", e))? as usize;

        let mut name_buf = vec![0u8; name_len];
        cursor
            .read_exact(&mut name_buf)
            .map_err(|e| format!("sensor name: {}", e))?;
        let name = String::from_utf8_lossy(&name_buf)
            .trim_end_matches('\0')
            .to_string();

        let mut id_buf = vec![0u8; id_len];
        cursor
            .read_exact(&mut id_buf)
            .map_err(|e| format!("sensor id: {}", e))?;
        let identifier = String::from_utf8_lossy(&id_buf)
            .trim_end_matches('\0')
            .to_string();

        let mut hw_id_buf = vec![0u8; hw_id_len];
        cursor
            .read_exact(&mut hw_id_buf)
            .map_err(|e| format!("sensor hw_id: {}", e))?;
        let hardware_identifier = String::from_utf8_lossy(&hw_id_buf)
            .trim_end_matches('\0')
            .to_string();

        let sensor_type_raw = cursor
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("sensor type: {}", e))?;
        let value = cursor
            .read_f32::<LittleEndian>()
            .map_err(|e| format!("sensor value: {}", e))?;

        sensors.push(Sensor {
            name,
            identifier,
            hardware_identifier,
            sensor_type: SensorType::from(sensor_type_raw),
            value,
        });
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    Ok(HardwareMonitorData {
        hardwares,
        sensors,
        last_poll_time: now,
    })
}

/// Parse a PresentMonApps packet (command 3)
fn parse_present_mon_apps(data: &[u8]) -> Result<Vec<String>, String> {
    let mut cursor = Cursor::new(data);
    let count = cursor
        .read_u16::<LittleEndian>()
        .map_err(|e| format!("app count: {}", e))? as usize;

    let mut apps = Vec::with_capacity(count);
    for i in 0..count {
        let start = 2 + (i * 128);
        if start + 128 > data.len() {
            break;
        }
        let raw = &data[start..start + 128];
        let name = String::from_utf8_lossy(raw)
            .trim_end_matches('\0')
            .trim()
            .to_string();
        if !name.is_empty() {
            apps.push(name);
        }
    }
    Ok(apps)
}

/// Build outgoing command bytes
fn build_command(cmd: &PipeCommand) -> Vec<u8> {
    let mut buf = Vec::new();
    match cmd {
        PipeCommand::RefreshPresentMonApps => {
            buf.write_u16::<LittleEndian>(1).unwrap();
        }
        PipeCommand::SelectPresentMonApp(name) => {
            buf.write_u16::<LittleEndian>(2).unwrap();
            let bytes = name.as_bytes();
            buf.write_u16::<LittleEndian>(bytes.len() as u16).unwrap();
            buf.extend_from_slice(bytes);
        }
        PipeCommand::SelectPollingRate(rate) => {
            buf.write_u16::<LittleEndian>(4).unwrap();
            buf.write_u16::<LittleEndian>(*rate).unwrap();
        }
    }
    buf
}

/// Named pipe client for Windows communication with HardwareMonitor backend
pub async fn run_pipe_client(
    app: AppHandle,
    mut cmd_rx: mpsc::Receiver<PipeCommand>,
    running: Arc<AtomicBool>,
) {
    let mut retry_delay = Duration::from_secs(2);
    let max_retry_delay = Duration::from_secs(10);

    while running.load(Ordering::Relaxed) {
        info!("Connecting to HardwareMonitor...");
        let _ = app.emit("pipe-status", PipeStatus { connected: false, error: None });

        let pipe_name = r"\\.\pipe\HardwareMonitor_31337";
        match std::fs::OpenOptions::new().read(true).write(true).open(pipe_name) {
            Ok(pipe_file) => {
                info!("Connected to HardwareMonitor via named pipe");
                let _ = app.emit("pipe-status", PipeStatus { connected: true, error: None });
                retry_delay = Duration::from_secs(2);

                let mut writer = match pipe_file.try_clone() {
                    Ok(w) => w,
                    Err(e) => {
                        error!("Failed to clone pipe handle: {}", e);
                        continue;
                    }
                };
                let mut reader = pipe_file;
                let app_for_read = app.clone();
                let running_for_read = running.clone();

                // Use a channel to send parsed events back from the blocking thread
                let (event_tx, mut event_rx) = mpsc::channel::<ParsedEvent>(64);

                // Spawn blocking read loop on a dedicated OS thread
                let read_handle = tokio::task::spawn_blocking(move || {
                    loop {
                        if !running_for_read.load(Ordering::Relaxed) {
                            break;
                        }

                        let command_raw = match read_u16(&mut reader) {
                            Ok(v) => v,
                            Err(e) => {
                                if e.kind() == io::ErrorKind::TimedOut
                                    || e.kind() == io::ErrorKind::WouldBlock
                                {
                                    continue;
                                }
                                warn!("Pipe read error: {}", e);
                                break;
                            }
                        };

                        let payload_size = match read_u32(&mut reader) {
                            Ok(v) => v as usize,
                            Err(e) => {
                                warn!("Failed to read payload size: {}", e);
                                break;
                            }
                        };

                        let mut payload = vec![0u8; payload_size];
                        if payload_size > 0 {
                            if let Err(e) = reader.read_exact(&mut payload) {
                                warn!("Failed to read payload: {}", e);
                                break;
                            }
                        }

                        match Command::try_from(command_raw) {
                            Ok(Command::Data) => {
                                match parse_data_packet(&payload) {
                                    Ok(data) => {
                                        let _ = event_tx.blocking_send(ParsedEvent::SensorData(data));
                                    }
                                    Err(e) => error!("Failed to parse data packet: {}", e),
                                }
                            }
                            Ok(Command::PresentMonApps) => {
                                match parse_present_mon_apps(&payload) {
                                    Ok(apps) => {
                                        let _ = event_tx.blocking_send(ParsedEvent::PresentMonApps(apps));
                                    }
                                    Err(e) => error!("Failed to parse present mon apps: {}", e),
                                }
                            }
                            _ => {}
                        }
                    }
                });

                // Async loop: forward events to Tauri and handle outgoing commands
                loop {
                    tokio::select! {
                        Some(cmd) = cmd_rx.recv() => {
                            let bytes = build_command(&cmd);
                            if let Err(e) = writer.write_all(&bytes) {
                                error!("Failed to send command: {}", e);
                                break;
                            }
                        }
                        Some(event) = event_rx.recv() => {
                            match event {
                                ParsedEvent::SensorData(data) => {
                                    let _ = app_for_read.emit("sensor-data", &data);
                                }
                                ParsedEvent::PresentMonApps(apps) => {
                                    let _ = app_for_read.emit("present-mon-apps", &apps);
                                }
                            }
                        }
                        else => break,
                    }

                    if !running.load(Ordering::Relaxed) {
                        break;
                    }
                }

                let _ = read_handle.await;
            }
            Err(e) => {
                let msg = format!("Connection failed: {}", e);
                warn!("{}", msg);
                let _ = app.emit(
                    "pipe-status",
                    PipeStatus {
                        connected: false,
                        error: Some(msg),
                    },
                );
            }
        }

        if !running.load(Ordering::Relaxed) {
            break;
        }

        // Wait before retrying
        tokio::time::sleep(retry_delay).await;
        retry_delay = (retry_delay * 2).min(max_retry_delay);
    }

    info!("Pipe client stopped");
}

fn read_u16<R: Read>(reader: &mut R) -> io::Result<u16> {
    reader.read_u16::<LittleEndian>()
}

fn read_u32<R: Read>(reader: &mut R) -> io::Result<u32> {
    reader.read_u32::<LittleEndian>()
}

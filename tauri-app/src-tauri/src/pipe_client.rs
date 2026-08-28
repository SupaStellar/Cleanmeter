use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use log::{error, info, warn};
use std::io::{self, Cursor, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

use crate::types::*;

/// Upper bound on one pipe frame. The sidecar's largest real packet is a full
/// sensor snapshot, which is tens of KB, so this leaves generous headroom.
///
/// The cap exists because every length prefix on this pipe arrives as a raw
/// integer from the sidecar and is used directly as an allocation size. Rust
/// aborts the process on allocation failure instead of unwinding, so a prefix
/// that is garbled (by a partial write, or by two writers interleaving on the
/// same byte-mode stream) takes the whole app down with no error path and no
/// message. Validating the prefix turns that abort into a dropped connection,
/// which the client already reconnects from.
const MAX_PIPE_PAYLOAD: usize = 4 * 1024 * 1024;

/// Smallest number of bytes one hardware entry can occupy: two u16 length
/// prefixes plus a u32 type tag.
const MIN_HARDWARE_BYTES: usize = 2 + 2 + 4;

/// Smallest number of bytes one sensor entry can occupy: three u16 length
/// prefixes, a u32 type tag and an f32 value.
const MIN_SENSOR_BYTES: usize = 2 + 2 + 2 + 4 + 4;

/// Fixed width of each entry in a PresentMonApps payload.
const PRESENT_MON_APP_STRIDE: usize = 128;

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
    /// Start (true) or stop (false) accumulating frametimes into the
    /// percentile-low histogram. Start clears what is there; stop computes a
    /// final figure and freezes it. See MonitorPacketCommand.SetLowsRecording.
    SetLowsRecording(bool),
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

    // Both counts are raw u32 off the wire and both are about to become
    // allocation sizes. Reject anything the remaining bytes could not possibly
    // describe before reserving, so a corrupt count is a parse error rather
    // than an aborting allocation.
    let remaining = data.len().saturating_sub(cursor.position() as usize);
    let max_hardwares = remaining / MIN_HARDWARE_BYTES;
    let max_sensors = remaining / MIN_SENSOR_BYTES;
    if hw_count as usize > max_hardwares {
        return Err(format!(
            "hw_count {} exceeds the {} entries {} remaining bytes can hold",
            hw_count, max_hardwares, remaining
        ));
    }
    if sensor_count as usize > max_sensors {
        return Err(format!(
            "sensor_count {} exceeds the {} entries {} remaining bytes can hold",
            sensor_count, max_sensors, remaining
        ));
    }

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

    // The loop below already stops when the payload runs out, but the
    // reservation happens first, so clamp it to what the payload can hold.
    let max_apps = data.len().saturating_sub(2) / PRESENT_MON_APP_STRIDE;
    let mut apps = Vec::with_capacity(count.min(max_apps));
    for i in 0..count {
        let start = 2 + (i * PRESENT_MON_APP_STRIDE);
        if start + PRESENT_MON_APP_STRIDE > data.len() {
            break;
        }
        let raw = &data[start..start + PRESENT_MON_APP_STRIDE];
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
        // u16 payload rather than a byte: every other command in this
        // protocol is u16-aligned, and the C# reader indexes fixed offsets
        // (BitConverter.ToInt16(data, 2)) rather than reading a stream.
        PipeCommand::SetLowsRecording(recording) => {
            buf.write_u16::<LittleEndian>(5).unwrap();
            buf.write_u16::<LittleEndian>(u16::from(*recording)).unwrap();
        }
    }
    buf
}

/// How long after losing (or before making) a connection we keep polling the
/// pipe rapidly, before falling back to a slow retry.
///
/// The sidecar only creates its pipe once LibreHardwareMonitor has finished
/// enumerating hardware, which measured at a median of 1.55s and up to 13.7s
/// across 114 real launches. Backing off exponentially from the first failed
/// attempt therefore guaranteed we were asleep when the pipe finally appeared:
/// the gap between "sidecar listening" and "app connected" was a median of
/// 3.08s and as much as 9.96s of pure dead time, and 61 of 113 runs wasted more
/// than 3s. That delay is the app's own, not the sidecar's.
///
/// Must stay longer than `STARTUP_GRACE_MS` in `src/lib/monitoring.ts`, which is
/// how long the UI treats a launch as still starting. That timer begins when the
/// settings webview mounts, i.e. later than this one, so if this window closed
/// first the client would be back on the slow backoff while the UI still expects
/// a connection, and a sidecar that appeared in the gap would produce the very
/// "not connected" banner this branch removes.
const FAST_POLL_WINDOW: Duration = Duration::from_secs(60);
/// Interval during that window. A failed open on a missing pipe is a cheap
/// `CreateFile` that fails immediately, so this costs nothing measurable.
const FAST_POLL_INTERVAL: Duration = Duration::from_millis(250);

/// What to do before the next connect attempt.
#[derive(Debug, PartialEq, Eq)]
enum RetryMode {
    /// Keep checking at `FAST_POLL_INTERVAL`: the sidecar may still be starting.
    FastPoll,
    /// Fall back to the growing delay: nothing has answered for long enough that
    /// polling is no longer worth it.
    Backoff,
}

/// A pure decision so the policy can be tested without a pipe or a sidecar.
fn retry_mode(disconnected_for: Duration) -> RetryMode {
    if disconnected_for < FAST_POLL_WINDOW {
        RetryMode::FastPoll
    } else {
        RetryMode::Backoff
    }
}

/// Named pipe client for Windows communication with HardwareMonitor backend
pub async fn run_pipe_client(
    app: AppHandle,
    mut cmd_rx: mpsc::Receiver<PipeCommand>,
    running: Arc<AtomicBool>,
) {
    let mut retry_delay = Duration::from_secs(2);
    let max_retry_delay = Duration::from_secs(10);
    // Start of the current disconnected stretch, reset on every successful
    // connect so a sidecar crash gets the same fast reconnect as startup.
    let mut disconnected_since = Instant::now();
    // Emit and log only on change: at a 250ms poll, announcing every failed
    // attempt would spam the log and re-render the frontend four times a second
    // for no new information.
    let mut announced_disconnect = false;
    let mut logged_failure = false;

    while running.load(Ordering::Relaxed) {
        if !announced_disconnect {
            info!("Connecting to HardwareMonitor...");
            let _ = app.emit("pipe-status", PipeStatus { connected: false });
            announced_disconnect = true;
        }

        let pipe_name = r"\\.\pipe\HardwareMonitor_31337";
        match std::fs::OpenOptions::new().read(true).write(true).open(pipe_name) {
            Ok(pipe_file) => {
                info!(
                    "Connected to HardwareMonitor via named pipe after {:.2}s",
                    disconnected_since.elapsed().as_secs_f32()
                );
                let _ = app.emit("pipe-status", PipeStatus { connected: true });
                retry_delay = Duration::from_secs(2);
                announced_disconnect = false;
                logged_failure = false;

                let mut writer = match pipe_file.try_clone() {
                    Ok(w) => w,
                    Err(e) => {
                        error!("Failed to clone pipe handle: {}", e);
                        continue;
                    }
                };
                // Re-assert the recording state on every connect.
                //
                // A sidecar that crashes is respawned by the supervisor in
                // lib.rs within ~1s, and it comes back with its histogram
                // recording (that is its startup default). Without this, a
                // stopped run — a benchmark result somebody is reading —
                // would quietly start moving again the moment the sidecar
                // bounced, and nothing on screen would say why. Only sent
                // when stopped: the fresh sidecar already agrees otherwise.
                if let Some(state) = app.try_state::<crate::shortcuts::ShortcutRegistry>() {
                    if !state.is_recording() {
                        let bytes = build_command(&PipeCommand::SetLowsRecording(false));
                        if let Err(e) = writer.write_all(&bytes) {
                            warn!("Could not re-assert the stopped recording state: {}", e);
                        }
                    }
                }

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

                        // Guard before allocating: see MAX_PIPE_PAYLOAD. A
                        // garbled prefix drops the connection, which the
                        // reconnect loop below already recovers from.
                        if payload_size > MAX_PIPE_PAYLOAD {
                            warn!(
                                "Pipe payload size {} exceeds the {} byte cap; dropping the connection",
                                payload_size, MAX_PIPE_PAYLOAD
                            );
                            break;
                        }

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
                // The connection just ended: start a fresh fast-poll window so a
                // sidecar crash reconnects as quickly as a cold start does.
                disconnected_since = Instant::now();
            }
            Err(e) => {
                // Expected, not exceptional, for the first seconds of a launch:
                // the sidecar has not created the pipe yet. Logged once per
                // disconnected stretch rather than once per attempt.
                if !logged_failure {
                    warn!("Connection failed: {}", e);
                    logged_failure = true;
                }
            }
        }

        if !running.load(Ordering::Relaxed) {
            break;
        }

        // Poll fast while the sidecar could still be coming up, then fall back to
        // the slow backoff so a genuinely absent sidecar is not polled forever.
        match retry_mode(disconnected_since.elapsed()) {
            RetryMode::FastPoll => tokio::time::sleep(FAST_POLL_INTERVAL).await,
            RetryMode::Backoff => {
                tokio::time::sleep(retry_delay).await;
                retry_delay = (retry_delay * 2).min(max_retry_delay);
            }
        }
    }

    info!("Pipe client stopped");
}

fn read_u16<R: Read>(reader: &mut R) -> io::Result<u16> {
    reader.read_u16::<LittleEndian>()
}

fn read_u32<R: Read>(reader: &mut R) -> io::Result<u32> {
    reader.read_u32::<LittleEndian>()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The measured shape of the bug. Sidecar startup, from process start to the
    /// pipe existing, ran to 13.7s across 114 logged launches, with the app then
    /// taking a median of 3.08s (worst 9.96s) to notice. Exponential backoff from
    /// the first failure is what produced that: by the time the pipe appeared the
    /// client was asleep for 8 to 10 seconds. Every one of these instants must
    /// still be inside the fast-poll window.
    #[test]
    fn a_sidecar_that_is_still_enumerating_is_polled_not_waited_on() {
        for secs in [0.0f32, 0.25, 1.55, 3.08, 4.41, 9.96, 13.7, 19.67, 30.0, 44.9] {
            assert_eq!(
                retry_mode(Duration::from_secs_f32(secs)),
                RetryMode::FastPoll,
                "{}s into a disconnected stretch is still plausible startup",
                secs
            );
        }
    }

    #[test]
    fn a_sidecar_that_never_answers_stops_being_polled() {
        assert_eq!(retry_mode(FAST_POLL_WINDOW), RetryMode::Backoff);
        assert_eq!(
            retry_mode(FAST_POLL_WINDOW + Duration::from_secs(60)),
            RetryMode::Backoff
        );
    }

    /// The window has to clear the slowest launch on record with room to spare,
    /// or the old dead time comes straight back for the slowest machines.
    #[test]
    fn the_fast_poll_window_clears_the_slowest_launch_measured() {
        let slowest_observed = Duration::from_millis(19_670);
        assert!(FAST_POLL_WINDOW > slowest_observed * 2);
    }

    /// Worst-case added latency after the pipe appears is one poll interval, so
    /// this bounds what the fix can leave on the table.
    #[test]
    fn the_poll_interval_bounds_the_remaining_delay() {
        assert!(FAST_POLL_INTERVAL <= Duration::from_millis(300));
    }

    /// Builds a Data payload the way MonitorPoller writes one: both counts, then
    /// the hardware entries, then the sensor entries.
    fn data_packet(hardwares: &[(&str, &str)], sensors: &[(&str, &str, &str)]) -> Vec<u8> {
        let mut b: Vec<u8> = Vec::new();
        b.write_u32::<LittleEndian>(hardwares.len() as u32).unwrap();
        b.write_u32::<LittleEndian>(sensors.len() as u32).unwrap();
        for (name, id) in hardwares {
            b.write_u16::<LittleEndian>(name.len() as u16).unwrap();
            b.write_u16::<LittleEndian>(id.len() as u16).unwrap();
            b.extend_from_slice(name.as_bytes());
            b.extend_from_slice(id.as_bytes());
            b.write_u32::<LittleEndian>(0).unwrap();
        }
        for (name, id, hw_id) in sensors {
            b.write_u16::<LittleEndian>(name.len() as u16).unwrap();
            b.write_u16::<LittleEndian>(id.len() as u16).unwrap();
            b.write_u16::<LittleEndian>(hw_id.len() as u16).unwrap();
            b.extend_from_slice(name.as_bytes());
            b.extend_from_slice(id.as_bytes());
            b.extend_from_slice(hw_id.as_bytes());
            b.write_u32::<LittleEndian>(0).unwrap();
            b.write_f32::<LittleEndian>(1.5).unwrap();
        }
        b
    }

    fn expect_rejected(packet: &[u8]) -> String {
        match parse_data_packet(packet) {
            Ok(_) => panic!("a corrupt count must be rejected, not parsed"),
            Err(e) => e,
        }
    }

    /// A count arriving off the wire used to reach `Vec::with_capacity`
    /// unvalidated. Rust aborts the process on allocation failure instead of
    /// unwinding, so an impossible count killed the app outright rather than
    /// failing the parse — and unsynchronized writes on the byte-mode pipe made
    /// a corrupt count reachable in ordinary operation.
    #[test]
    fn an_impossible_hardware_count_is_rejected_rather_than_allocated() {
        let mut packet = data_packet(&[("CPU", "/amdcpu/0")], &[]);
        packet[0..4].copy_from_slice(&u32::MAX.to_le_bytes());
        let err = expect_rejected(&packet);
        assert!(err.contains("hw_count"), "unexpected error: {}", err);
    }

    #[test]
    fn an_impossible_sensor_count_is_rejected_rather_than_allocated() {
        let mut packet = data_packet(&[("CPU", "/amdcpu/0")], &[]);
        packet[4..8].copy_from_slice(&u32::MAX.to_le_bytes());
        let err = expect_rejected(&packet);
        assert!(err.contains("sensor_count"), "unexpected error: {}", err);
    }

    /// The guard is worthless if it also turns away the packets the sidecar
    /// really sends, which is the way a validation fix breaks a working app.
    #[test]
    fn a_well_formed_packet_still_parses() {
        let packet = data_packet(
            &[("CPU", "/amdcpu/0"), ("GPU", "/gpu-nvidia/0")],
            &[
                ("CPU Total", "/load/0", "/amdcpu/0"),
                ("GPU Core", "/temperature/0", "/gpu-nvidia/0"),
            ],
        );
        let parsed = parse_data_packet(&packet).expect("a well-formed packet must parse");
        assert_eq!(parsed.hardwares.len(), 2);
        assert_eq!(parsed.sensors.len(), 2);
        assert_eq!(parsed.hardwares[0].name, "CPU");
        assert_eq!(parsed.sensors[1].name, "GPU Core");
    }

    /// An empty snapshot is what the sidecar sends before LibreHardwareMonitor
    /// has activated anything, so zero counts must stay valid.
    #[test]
    fn an_empty_snapshot_is_valid() {
        let parsed = parse_data_packet(&data_packet(&[], &[])).expect("empty snapshot must parse");
        assert!(parsed.hardwares.is_empty());
        assert!(parsed.sensors.is_empty());
    }

    /// The app-list reservation is clamped to what the payload can actually
    /// hold, so an inflated count cannot make it reserve for absent entries.
    #[test]
    fn an_inflated_app_count_yields_only_the_apps_present() {
        let mut payload: Vec<u8> = Vec::new();
        payload.write_u16::<LittleEndian>(9999).unwrap();
        let mut entry = vec![0u8; PRESENT_MON_APP_STRIDE];
        entry[.."game.exe".len()].copy_from_slice(b"game.exe");
        payload.extend_from_slice(&entry);
        let apps = parse_present_mon_apps(&payload).expect("payload must parse");
        assert_eq!(apps, vec!["game.exe".to_string()]);
    }
}

//! Read-only Linux telemetry. Missing/permission-denied optional sensors are
//! omitted; the backend never elevates privileges or substitutes another GPU.
use crate::types::{Hardware, HardwareMonitorData, HardwareType, Sensor, SensorType};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Default)]
pub struct LinuxSensors {
    cpu: Option<(u64, u64)>,
    network: HashMap<String, (u64, u64)>,
}

pub fn sensor(hw: &str, key: &str, name: &str, kind: SensorType, value: f64) -> Option<Sensor> {
    if !value.is_finite() || value < 0.0 || value > f32::MAX as f64 {
        return None;
    }
    Some(Sensor {
        identifier: format!("{hw}/{key}"),
        hardware_identifier: hw.into(),
        name: name.into(),
        sensor_type: kind,
        value: value as f32,
    })
}
fn add(
    data: &mut HardwareMonitorData,
    hw: &str,
    key: &str,
    name: &str,
    kind: SensorType,
    value: f64,
) {
    if let Some(s) = sensor(hw, key, name, kind, value) {
        data.sensors.push(s);
    }
}
fn hardware(data: &mut HardwareMonitorData, id: &str, name: &str, kind: HardwareType) {
    data.hardwares.push(Hardware {
        identifier: id.into(),
        name: name.into(),
        hardware_type: kind,
    });
}
fn number(path: impl AsRef<Path>) -> Option<f64> {
    fs::read_to_string(path).ok()?.trim().parse().ok()
}
fn entries(path: impl AsRef<Path>) -> Vec<PathBuf> {
    let mut paths: Vec<_> = fs::read_dir(path)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|e| e.path())
        .collect();
    paths.sort();
    paths
}
fn cpu_counters(text: &str) -> Option<(u64, u64)> {
    let line = text.lines().find(|l| l.starts_with("cpu "))?;
    // guest and guest_nice are already included in user/nice; don't count twice.
    let fields: Vec<u64> = line
        .split_whitespace()
        .skip(1)
        .take(8)
        .map(str::parse)
        .collect::<Result<_, _>>()
        .ok()?;
    if fields.len() < 4 {
        return None;
    }
    Some((
        fields.iter().try_fold(0u64, |a, b| a.checked_add(*b))?,
        fields[3].checked_add(*fields.get(4).unwrap_or(&0))?,
    ))
}
fn memory(text: &str) -> Option<(u64, u64)> {
    let values: HashMap<_, _> = text
        .lines()
        .filter_map(|l| {
            let mut v = l.split_whitespace();
            Some((
                v.next()?.trim_end_matches(':'),
                v.next()?.parse::<u64>().ok()?,
            ))
        })
        .collect();
    let total = *values.get("MemTotal")?;
    let available = *values.get("MemAvailable")?;
    if total == 0 || available > total {
        return None;
    }
    Some((total, total - available))
}
fn network(text: &str) -> HashMap<String, (u64, u64)> {
    text.lines()
        .filter_map(|l| {
            let (name, fields) = l.split_once(':')?;
            let name = name.trim();
            if name == "lo" {
                return None;
            }
            let v: Vec<_> = fields.split_whitespace().collect();
            Some((
                name.into(),
                (v.first()?.parse().ok()?, v.get(8)?.parse().ok()?),
            ))
        })
        .collect()
}

impl LinuxSensors {
    pub fn sample(
        &mut self,
        proc: &Path,
        sys: &Path,
        elapsed: Duration,
    ) -> Result<HardwareMonitorData, String> {
        let cpu = cpu_counters(
            &fs::read_to_string(proc.join("stat"))
                .map_err(|e| format!("CPU readings unavailable: {e}"))?,
        )
        .ok_or("Invalid /proc/stat")?;
        let (total, used) = memory(
            &fs::read_to_string(proc.join("meminfo"))
                .map_err(|e| format!("Memory readings unavailable: {e}"))?,
        )
        .ok_or("Invalid /proc/meminfo")?;
        let mut data = HardwareMonitorData {
            hardwares: vec![],
            sensors: vec![],
            last_poll_time: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64,
        };
        let cpu_name = fs::read_to_string(proc.join("cpuinfo"))
            .ok()
            .and_then(|s| {
                s.lines().find_map(|l| {
                    l.strip_prefix("model name")
                        .and_then(|l| l.split_once(':'))
                        .map(|(_, v)| v.trim().to_owned())
                })
            })
            .unwrap_or_else(|| "CPU".into());
        hardware(&mut data, "/linux/cpu", &cpu_name, HardwareType::Cpu);
        if let Some((prev_total, prev_idle)) = self.cpu {
            if let (Some(delta), Some(idle)) =
                (cpu.0.checked_sub(prev_total), cpu.1.checked_sub(prev_idle))
            {
                if delta > 0 && idle <= delta {
                    add(
                        &mut data,
                        "/linux/cpu",
                        "load",
                        "CPU Total",
                        SensorType::Load,
                        100.0 * (delta - idle) as f64 / delta as f64,
                    );
                }
            }
        }
        self.cpu = Some(cpu);
        hardware(&mut data, "/ram", "Physical Memory", HardwareType::Memory);
        add(
            &mut data,
            "/ram",
            "load",
            "Memory",
            SensorType::Load,
            100.0 * used as f64 / total as f64,
        );
        add(
            &mut data,
            "/ram",
            "used",
            "Memory Used",
            SensorType::Data,
            used as f64 / 1_048_576.0,
        );
        add(
            &mut data,
            "/ram",
            "total",
            "Memory Total",
            SensorType::Data,
            total as f64 / 1_048_576.0,
        );
        let net = network(&fs::read_to_string(proc.join("net/dev")).unwrap_or_default());
        let mut names: Vec<_> = net.keys().collect();
        names.sort();
        for name in names {
            let (rx, tx) = net[name];
            let id = format!("/linux/network/{name}");
            hardware(&mut data, &id, name, HardwareType::Network);
            if let Some((old_rx, old_tx)) = self.network.get(name) {
                if elapsed.as_secs_f64() > 0.0 {
                    if let Some(delta) = rx.checked_sub(*old_rx) {
                        add(
                            &mut data,
                            &id,
                            "download",
                            "Download Speed",
                            SensorType::Throughput,
                            delta as f64 / elapsed.as_secs_f64(),
                        );
                    }
                    if let Some(delta) = tx.checked_sub(*old_tx) {
                        add(
                            &mut data,
                            &id,
                            "upload",
                            "Upload Speed",
                            SensorType::Throughput,
                            delta as f64 / elapsed.as_secs_f64(),
                        );
                    }
                }
            }
        }
        self.network = net;
        for hw in entries(sys.join("class/hwmon")) {
            let name = fs::read_to_string(hw.join("name")).unwrap_or_default();
            if matches!(
                name.trim(),
                "coretemp" | "k10temp" | "zenpower" | "cpu_thermal" | "fam15h_power"
            ) {
                // Pick package/Tctl/Tdie over a single core where labels exist.
                let mut temps: Vec<_> = entries(&hw)
                    .into_iter()
                    .filter(|p| {
                        p.file_name()
                            .and_then(|s| s.to_str())
                            .map(|s| s.starts_with("temp") && s.ends_with("_input"))
                            .unwrap_or(false)
                    })
                    .collect();
                temps.sort_by_key(|p| {
                    let label = fs::read_to_string(
                        p.with_file_name(
                            p.file_name()
                                .unwrap()
                                .to_string_lossy()
                                .replace("_input", "_label"),
                        ),
                    )
                    .unwrap_or_default();
                    if label.contains("Package") || label.contains("Tctl") || label.contains("Tdie")
                    {
                        0
                    } else {
                        1
                    }
                });
                if let Some(value) = temps.iter().find_map(number) {
                    add(
                        &mut data,
                        "/linux/cpu",
                        "temperature",
                        "CPU Package",
                        SensorType::Temperature,
                        value / 1000.0,
                    );
                    break;
                }
            }
        }
        for card in entries(sys.join("class/drm")) {
            let name = card.file_name().unwrap_or_default().to_string_lossy();
            if !name
                .strip_prefix("card")
                .map(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit()))
                .unwrap_or(false)
            {
                continue;
            }
            let device = card.join("device");
            let vendor = fs::read_to_string(device.join("vendor")).unwrap_or_default();
            let (kind, label) = match vendor.trim() {
                "0x1002" => (HardwareType::GpuAmd, "AMD GPU"),
                "0x8086" => (HardwareType::GpuIntel, "Intel GPU"),
                _ => continue,
            };
            let address = fs::canonicalize(&device)
                .ok()
                .and_then(|p| p.file_name().map(|s| s.to_string_lossy().into_owned()))
                .unwrap_or_else(|| name.into_owned());
            let id = format!("/linux/gpu/{address}");
            hardware(&mut data, &id, &format!("{label} ({address})"), kind);
            if let Some(v) = number(device.join("gpu_busy_percent")).filter(|v| *v <= 100.0) {
                add(&mut data, &id, "load", "GPU Core", SensorType::Load, v);
            }
            if let Some(used) =
                number(device.join("mem_info_vram_used")).filter(|v| v.is_finite() && *v >= 0.0)
            {
                add(
                    &mut data,
                    &id,
                    "memory-used",
                    "GPU Memory Used",
                    SensorType::SmallData,
                    used / 1_048_576.0,
                );
                if let Some(total) =
                    number(device.join("mem_info_vram_total")).filter(|v| v.is_finite() && *v > 0.0)
                {
                    add(
                        &mut data,
                        &id,
                        "memory-total",
                        "GPU Memory Total",
                        SensorType::SmallData,
                        total / 1_048_576.0,
                    );
                    add(
                        &mut data,
                        &id,
                        "memory-load",
                        "GPU Memory",
                        SensorType::Load,
                        (100.0 * used / total).min(100.0),
                    );
                }
            }
            for hw in entries(device.join("hwmon")) {
                if let Some(v) = number(hw.join("temp1_input")) {
                    add(
                        &mut data,
                        &id,
                        "temperature",
                        "GPU Core",
                        SensorType::Temperature,
                        v / 1000.0,
                    );
                }
                if let Some(v) =
                    number(hw.join("power1_average")).or_else(|| number(hw.join("power1_input")))
                {
                    add(
                        &mut data,
                        &id,
                        "power",
                        "GPU Power",
                        SensorType::Power,
                        v / 1_000_000.0,
                    );
                }
            }
        }
        Ok(data)
    }
}

/// NVIDIA's driver supplies nvidia-smi; unknown/N/A fields stay absent.
pub fn append_nvidia(data: &mut HardwareMonitorData, csv: &str) {
    for row in csv.lines().take(32) {
        let v: Vec<_> = row.split(',').map(str::trim).collect();
        if v.len() != 7 || !v[0].starts_with("GPU-") {
            continue;
        }
        let id = format!("/linux/nvidia/{}", v[0]);
        hardware(data, &id, v[1], HardwareType::GpuNvidia);
        for (idx, key, name, kind) in [
            (2, "load", "GPU Core", SensorType::Load),
            (3, "temperature", "GPU Core", SensorType::Temperature),
            (4, "memory-used", "GPU Memory Used", SensorType::SmallData),
            (5, "memory-total", "GPU Memory Total", SensorType::SmallData),
            (6, "power", "GPU Power", SensorType::Power),
        ] {
            if let Ok(n) = v[idx].parse::<f64>() {
                add(data, &id, key, name, kind, n);
            }
        }
        if let (Ok(used), Ok(total)) = (v[4].parse::<f64>(), v[5].parse::<f64>()) {
            if used.is_finite() && used >= 0.0 && total.is_finite() && total > 0.0 {
                add(
                    data,
                    &id,
                    "memory-load",
                    "GPU Memory",
                    SensorType::Load,
                    (100.0 * used / total).min(100.0),
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cpu_does_not_double_count_guests() {
        assert_eq!(
            cpu_counters("cpu  100 20 30 400 10 2 3 5 40 8"),
            Some((570, 410))
        );
    }
    #[test]
    fn memory_excludes_reclaimable_cache() {
        assert_eq!(
            memory("MemTotal: 1000 kB\nMemFree: 100 kB\nMemAvailable: 600 kB"),
            Some((1000, 400))
        );
        assert_eq!(memory("MemTotal: 0 kB\nMemAvailable: 0 kB"), None);
    }
    #[test]
    fn network_uses_byte_counters_and_excludes_loopback() {
        let n = network(" lo: 99 0 0 0 0 0 0 0 99\n eth0: 1000 0 0 0 0 0 0 0 2000");
        assert_eq!(n.len(), 1);
        assert_eq!(n["eth0"], (1000, 2000));
    }
    #[test]
    fn nvidia_omits_unavailable_and_nonfinite_values() {
        let mut d = HardwareMonitorData {
            hardwares: vec![],
            sensors: vec![],
            last_poll_time: 0,
        };
        append_nvidia(&mut d, "GPU-123, RTX Test, 30, N/A, 1024, 4096, NaN");
        assert_eq!(d.hardwares.len(), 1);
        assert!(!d.sensors.iter().any(
            |s| s.sensor_type == SensorType::Temperature || s.sensor_type == SensorType::Power
        ));
        assert_eq!(
            d.sensors
                .iter()
                .find(|s| s.identifier.ends_with("memory-load"))
                .unwrap()
                .value,
            25.0
        );
        d.sensors.clear();
        append_nvidia(&mut d, "GPU-123, RTX Test, 30, 60, NaN, 4096, 120");
        assert!(!d
            .sensors
            .iter()
            .any(|s| s.identifier.ends_with("memory-load")));
    }
    #[test]
    fn fixture_rates_units_and_counter_reset() {
        let root = std::env::temp_dir().join(format!(
            "cleanmeter-linux-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("net")).unwrap();
        fs::write(root.join("stat"), "cpu 100 0 0 100 0 0 0 0").unwrap();
        fs::write(
            root.join("meminfo"),
            "MemTotal: 2097152 kB\nMemAvailable: 1048576 kB",
        )
        .unwrap();
        fs::write(root.join("net/dev"), "eth0: 100 0 0 0 0 0 0 0 200").unwrap();
        let gpu = root.join("class/drm/card0/device");
        fs::create_dir_all(gpu.join("hwmon/hwmon0")).unwrap();
        for (file, value) in [
            ("vendor", "0x1002"),
            ("gpu_busy_percent", "42"),
            ("mem_info_vram_used", "1073741824"),
            ("mem_info_vram_total", "4294967296"),
            ("hwmon/hwmon0/temp1_input", "65000"),
            ("hwmon/hwmon0/power1_average", "125000000"),
        ] {
            fs::write(gpu.join(file), value).unwrap();
        }
        let mut s = LinuxSensors::default();
        s.sample(&root, &root, Duration::from_secs(1)).unwrap();
        fs::write(root.join("stat"), "cpu 150 0 0 150 0 0 0 0").unwrap();
        fs::write(root.join("net/dev"), "eth0: 1100 0 0 0 0 0 0 0 2200").unwrap();
        let d = s.sample(&root, &root, Duration::from_millis(500)).unwrap();
        assert!(d
            .hardwares
            .iter()
            .any(|h| h.hardware_type == HardwareType::GpuAmd));
        for (name, kind, expected) in [
            ("GPU Core", SensorType::Load, 42.0),
            ("GPU Core", SensorType::Temperature, 65.0),
            ("GPU Power", SensorType::Power, 125.0),
            ("GPU Memory Used", SensorType::SmallData, 1024.0),
            ("GPU Memory", SensorType::Load, 25.0),
        ] {
            assert_eq!(
                d.sensors
                    .iter()
                    .find(|s| s.name == name && s.sensor_type == kind)
                    .unwrap()
                    .value,
                expected
            );
        }
        assert_eq!(
            d.sensors
                .iter()
                .find(|v| v.name == "CPU Total")
                .unwrap()
                .value,
            50.0
        );
        assert_eq!(
            d.sensors
                .iter()
                .find(|v| v.name == "Download Speed")
                .unwrap()
                .value,
            2000.0
        );
        assert_eq!(
            d.sensors
                .iter()
                .find(|v| v.name == "Memory Used")
                .unwrap()
                .value,
            1.0
        );
        fs::write(root.join("net/dev"), "eth0: 1 0 0 0 0 0 0 0 1").unwrap();
        assert!(!s
            .sample(&root, &root, Duration::from_secs(1))
            .unwrap()
            .sensors
            .iter()
            .any(|s| s.sensor_type == SensorType::Throughput));
        fs::remove_dir_all(root).unwrap();
    }
}

use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

// Per-log cap. Three logs stay well under the portal's 2 MB diagnostics limit
// while keeping enough history to cover a session that went wrong.
const LOG_TAIL_BYTES: usize = 256 * 1024;

// Opt-in diagnostics sent beside the feedback, never inside the message: a
// one-line summary the portal shows inline, and a text report it stores as a file.
pub struct Diagnostics {
    pub summary: String,
    pub report: String,
}

pub fn collect(resource_dir: Option<&Path>) -> Diagnostics {
    let version = env!("CARGO_PKG_VERSION");
    let os = os_name();
    let cpu = cpu_name();
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().to_string())
        .unwrap_or_else(|_| "unknown".into());

    // The portal card already shows app version and OS family, so the summary
    // carries only what it lacks.
    let mut summary = vec![os.clone()];
    summary.extend(cpu.clone());
    summary.push(format!("{threads} threads"));

    let mut report = format!(
        "Cleanmeter diagnostics\n\nApp version: {version}\nOS: {os}\nCPU: {}\nLogical processors: {threads}\n",
        cpu.as_deref().unwrap_or("unknown"),
    );

    let app_log = dirs::data_local_dir()
        .map(|dir| dir.join("Cleanmeter").join("Logs").join("cleanmeter.log"));
    let ui_log = Some(std::env::temp_dir().join("cleanmeter-ui.log"));
    let sidecar_log = resource_dir
        .and_then(latest_sidecar_log)
        .or_else(|| std::env::current_exe().ok().and_then(|p| p.parent().and_then(latest_sidecar_log)));

    for (label, path) in [("Cleanmeter", app_log), ("UI", ui_log), ("HardwareMonitor", sidecar_log)] {
        report.push_str(&format!("\n===== {label} log =====\n"));
        match path.as_deref().map(|p| read_tail(p, LOG_TAIL_BYTES)) {
            Some(Ok(Some(text))) => {
                report.push_str(&text);
                if !text.ends_with('\n') {
                    report.push('\n');
                }
            }
            Some(Err(e)) if e.kind() != std::io::ErrorKind::NotFound => {
                report.push_str(&format!("(unreadable: {e})\n"));
            }
            _ => report.push_str("(not available)\n"),
        }
    }

    Diagnostics { summary: summary.join(" · "), report }
}

// Ok(None) means the log exists but holds nothing worth sending.
fn read_tail(path: &Path, limit: usize) -> std::io::Result<Option<String>> {
    // The app runs elevated: never follow a link planted at a log path into a
    // file the user could not otherwise read.
    if std::fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err(std::io::Error::other("log path is a symbolic link"));
    }
    let mut file = std::fs::File::open(path)?;
    let len = file.metadata()?.len();
    let start = len.saturating_sub(limit as u64);
    file.seek(SeekFrom::Start(start))?;
    let mut bytes = Vec::with_capacity(limit);
    file.take(limit as u64).read_to_end(&mut bytes)?;
    // A seek may land in the middle of a line or UTF-8 character; start at the
    // next full line when there is one.
    let bytes = match bytes.iter().position(|byte| *byte == b'\n') {
        Some(newline) if start > 0 => &bytes[newline + 1..],
        _ => bytes.as_slice(),
    };
    // The portal only stores clean UTF-8 text: replace invalid sequences and
    // drop NULs rather than losing the whole log over one bad byte.
    let mut text = String::from_utf8_lossy(bytes).replace('\0', "");
    // Each replaced byte grows to 3, so re-apply the cap after conversion to
    // keep three logs inside the portal's 2 MB limit.
    if text.len() > limit {
        let mut cut = text.len() - limit;
        while !text.is_char_boundary(cut) {
            cut += 1;
        }
        text.drain(..cut);
    }
    Ok(if text.trim().is_empty() { None } else { Some(text) })
}

fn latest_sidecar_log(base: &Path) -> Option<PathBuf> {
    std::fs::read_dir(base.join("LogFiles"))
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("Log.txt"))
        .filter(|path| path.is_file())
        .max_by_key(|path| path.metadata().and_then(|m| m.modified()).ok())
}

#[cfg(windows)]
fn cpu_name() -> Option<String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        .ok()?
        .get_value::<String, _>("ProcessorNameString")
        .ok()
        .map(|name| name.trim().to_string())
}

#[cfg(not(windows))]
fn cpu_name() -> Option<String> {
    std::env::var("PROCESSOR_IDENTIFIER").ok()
}

// "Windows 11 25H2 (build 26200) x86_64". ProductName still says "Windows 10"
// on Windows 11, so the major version comes from the build number instead.
#[cfg(windows)]
fn os_name() -> String {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let arch = std::env::consts::ARCH;
    let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion") else {
        return format!("Windows {arch}");
    };
    let build: Option<u32> = key
        .get_value::<String, _>("CurrentBuildNumber")
        .ok()
        .and_then(|b| b.trim().parse().ok());
    let release = key.get_value::<String, _>("DisplayVersion").ok();
    let major = match build {
        Some(b) if b >= 22000 => "Windows 11",
        Some(_) => "Windows 10",
        None => "Windows",
    };
    let mut name = major.to_string();
    if let Some(release) = release {
        name.push_str(&format!(" {}", release.trim()));
    }
    if let Some(build) = build {
        name.push_str(&format!(" (build {build})"));
    }
    format!("{name} {arch}")
}

#[cfg(not(windows))]
fn os_name() -> String {
    format!("{} {}", std::env::consts::OS, std::env::consts::ARCH)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_carries_specs_and_every_log_section() {
        let d = collect(None);
        assert!(d.summary.ends_with("threads"));
        assert!(!d.summary.contains('\n'));
        assert!(d.report.contains("App version:"));
        for label in ["Cleanmeter", "UI", "HardwareMonitor"] {
            assert!(d.report.contains(&format!("===== {label} log =====")));
        }
        // The portal rejects diagnostics over 2 MB.
        assert!(d.report.len() < 2 * 1024 * 1024);
    }

    fn tail_of(name: &str, content: &[u8], limit: usize) -> std::io::Result<Option<String>> {
        let path = std::env::temp_dir().join(format!("cm-diag-{name}-{}.log", std::process::id()));
        std::fs::write(&path, content).unwrap();
        let tail = read_tail(&path, limit);
        std::fs::remove_file(&path).ok();
        tail
    }

    #[test]
    fn tail_is_clean_utf8_starting_on_a_line() {
        let mut content = b"first line cut\n".to_vec();
        content.extend_from_slice(b"second \0line \xff ok\nthird\n");
        let tail = tail_of("lines", &content, content.len() - 3).unwrap().unwrap();
        assert_eq!(tail, "second line \u{fffd} ok\nthird\n");
    }

    #[test]
    fn tail_without_a_newline_is_kept() {
        let tail = tail_of("oneline", &[b'x'; 64], 16).unwrap().unwrap();
        assert_eq!(tail, "x".repeat(16));
    }

    #[test]
    fn invalid_utf8_tail_stays_within_its_cap() {
        let tail = tail_of("binary", &[0xff; 4096], 1024).unwrap().unwrap();
        assert!(tail.len() <= 1024);
        assert!(tail.chars().all(|c| c == '\u{fffd}'));
    }

    #[test]
    fn missing_log_is_not_found() {
        let missing = std::env::temp_dir().join("cm-diag-does-not-exist.log");
        assert_eq!(read_tail(&missing, 16).unwrap_err().kind(), std::io::ErrorKind::NotFound);
    }
}

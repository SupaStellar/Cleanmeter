use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const MAX_MESSAGE_BYTES: usize = 4900;

// The portal stores a single message and one optional file. Put opt-in
// diagnostics in the message so a manually selected file can coexist with them.
pub fn append(message: &str, resource_dir: Option<&Path>) -> Result<String, String> {
    let mut result = format!(
        "{message}\n\n--- System specs and app logs (included by user) ---\n\
         App version: {}\nOS: {} ({})\nLogical processors: {}\n",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH,
        std::thread::available_parallelism().map(|n| n.get().to_string()).unwrap_or_else(|_| "unknown".into()),
    );

    if let Some(cpu) = cpu_name() {
        result.push_str(&format!("CPU: {cpu}\n"));
    }

    if result.len() + 120 > MAX_MESSAGE_BYTES {
        return Err("Message is too long to include system specs and app logs.".into());
    }

    let app_log = dirs::data_local_dir()
        .map(|dir| dir.join("Cleanmeter").join("Logs").join("cleanmeter.log"));
    let ui_log = Some(std::env::temp_dir().join("cleanmeter-ui.log"));
    let sidecar_log = resource_dir
        .and_then(latest_sidecar_log)
        .or_else(|| std::env::current_exe().ok().and_then(|p| p.parent().and_then(latest_sidecar_log)));

    let logs = [
        ("Cleanmeter", app_log),
        ("UI", ui_log),
        ("HardwareMonitor", sidecar_log),
    ];

    for (index, (label, path)) in logs.into_iter().enumerate() {
        let remaining_logs = 3 - index;
        let allowance = MAX_MESSAGE_BYTES.saturating_sub(result.len()) / remaining_logs;
        let heading = format!("\n{label} log:\n");
        if allowance <= heading.len() + 32 {
            return Err("Message is too long to include system specs and app logs.".into());
        }
        result.push_str(&heading);
        let content = path
            .as_deref()
            .and_then(|p| read_tail(p, allowance - heading.len() - 1))
            .unwrap_or_else(|| "(not available)\n".into());
        result.push_str(&content);
        if !content.ends_with('\n') {
            result.push('\n');
        }
    }

    Ok(result)
}

fn read_tail(path: &Path, limit: usize) -> Option<String> {
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(limit as u64);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut bytes = Vec::with_capacity(limit);
    file.take(limit as u64).read_to_end(&mut bytes).ok()?;
    if bytes.is_empty() {
        return None;
    }
    // A seek may land in the middle of a line or UTF-8 character.
    let bytes = if start > 0 {
        bytes.splitn(2, |byte| *byte == b'\n').nth(1)?
    } else {
        bytes.as_slice()
    };
    let text = std::str::from_utf8(bytes).ok()?;
    if text.trim().is_empty() {
        None
    } else {
        Some(text.to_string())
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_fit_portal_limit_and_keep_user_message() {
        let message = "Feedback ".repeat(300);
        let result = append(&message, None).unwrap();
        assert!(result.starts_with(&message));
        assert!(result.contains("App version:"));
        assert!(result.contains("Cleanmeter log:"));
        assert!(result.len() <= MAX_MESSAGE_BYTES);
    }

    #[test]
    fn rejects_message_without_room_for_diagnostics() {
        assert!(append(&"x".repeat(MAX_MESSAGE_BYTES), None).is_err());
    }
}
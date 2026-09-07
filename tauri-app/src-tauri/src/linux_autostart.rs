use std::{fs, path::Path};

/// Desktop Entry Exec quoting has two escaping layers: argument quoting and
/// desktop-string escaping. Percent is a field-code marker, not a shell escape.
fn desktop_exec(exe: &str) -> Result<String, String> {
    if exe.chars().any(|c| c == '\n' || c == '\r' || c == '\0') {
        return Err("Invalid executable path".into());
    }
    let mut out = String::from("\"");
    for c in exe.chars() {
        match c {
            '%' => out.push_str("%%"),
            '\\' => out.push_str("\\\\\\\\"),
            '"' | '`' | '$' => {
                out.push_str("\\\\");
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out.push('"');
    Ok(out)
}
pub fn set(config: &Path, exe: &Path, enabled: bool) -> Result<(), String> {
    let path = config.join("autostart/com.cleanmeter.desktop");
    if !enabled {
        return match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        };
    }
    let exec = desktop_exec(exe.to_str().ok_or("Executable path is not UTF-8")?)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(path,format!("[Desktop Entry]\nType=Application\nName=Cleanmeter\nExec={exec}\nTerminal=false\nX-GNOME-Autostart-enabled=true\n")).map_err(|e|e.to_string())
}
pub fn enabled(config: &Path) -> bool {
    fs::read_to_string(config.join("autostart/com.cleanmeter.desktop"))
        .map(|s| {
            !s.lines()
                .any(|l| matches!(l.trim(), "Hidden=true" | "X-GNOME-Autostart-enabled=false"))
        })
        .unwrap_or(false)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exec_paths_are_literal() {
        assert_eq!(
            desktop_exec("/opt/Clean meter/100%/app").unwrap(),
            "\"/opt/Clean meter/100%%/app\""
        );
        assert_eq!(desktop_exec("/tmp/$HOME").unwrap(), "\"/tmp/\\\\$HOME\"");
        assert!(desktop_exec("a\nb").is_err());
    }

    #[test]
    fn toggles_only_our_autostart_entry() {
        let root = std::env::temp_dir().join(format!(
            "cleanmeter-autostart-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(root.join("autostart")).unwrap();
        let other = root.join("autostart/another.desktop");
        fs::write(&other, "other app").unwrap();
        assert!(!enabled(&root));
        set(&root, Path::new("/apps/Clean meter.AppImage"), true).unwrap();
        assert!(enabled(&root));
        set(&root, Path::new("/apps/Clean meter.AppImage"), false).unwrap();
        assert!(!enabled(&root));
        set(&root, Path::new("/apps/Clean meter.AppImage"), false).unwrap();
        assert_eq!(fs::read_to_string(other).unwrap(), "other app");
        fs::remove_dir_all(root).unwrap();
    }
}

//! Explorer owns the optional launch hotkey. No monitoring process is needed
//! while Cleanmeter is closed. The already-elevated app explicitly installs
//! an on-demand task so subsequent toggles do not prompt for elevation.
use std::sync::Mutex;

pub const TOGGLE_ARG: &str = "--toggle-overlay";
pub const LAUNCH_TASK: &str = "Cleanmeter Overlay Hotkey";

fn task_xml(exe: &str, user: &str) -> String {
    fn escape(value: &str) -> String {
        value
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals><Principal id="User"><UserId>{}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><AllowStartOnDemand>true</AllowStartOnDemand><ExecutionTimeLimit>PT0S</ExecutionTimeLimit></Settings>
  <Actions Context="User"><Exec><Command>{}</Command><Arguments>{}</Arguments></Exec></Actions>
</Task>"#,
        escape(user),
        escape(exe),
        TOGGLE_ARG
    )
}
pub fn is_overlay_launch(args: &[String]) -> bool {
    args.iter().skip(1).any(|arg| arg == TOGGLE_ARG)
}

// IShellLink stores a virtual key in the low byte and HOTKEYF_* in the high
// byte (different values from RegisterHotKey's MOD_*). Restrict this mode to
// Ctrl+Alt combinations; Win and media keys cannot be represented here.
pub fn shell_hotkey(accelerator: &str) -> Result<u16, String> {
    let mut modifiers = 0u16;
    let mut key = None;
    for part in accelerator.split('+') {
        match part {
            "Ctrl" | "Control" => modifiers |= 2,
            "Alt" => modifiers |= 4,
            "Shift" => modifiers |= 1,
            value => {
                if key.is_some() {
                    return Err("Choose one key with Ctrl+Alt.".into());
                }
                key = Some(match value {
                    "Space" => 0x20,
                    v if v.starts_with("Key") && v.len() == 4 && v.as_bytes()[3].is_ascii_uppercase() => v.as_bytes()[3] as u16,
                    v if v.starts_with("Digit") && v.len() == 6 && v.as_bytes()[5].is_ascii_digit() => v.as_bytes()[5] as u16,
                    v if v.len() == 1 && v.as_bytes()[0].is_ascii_alphanumeric() => v.as_bytes()[0].to_ascii_uppercase() as u16,
                    v if v.starts_with('F') => {
                        let number = v[1..].parse::<u16>().unwrap_or(0);
                        if !(1..=11).contains(&number) { return Err("Use F1 through F11 for a launch shortcut.".into()); }
                        0x70 + number - 1
                    }
                    _ => return Err("Launch shortcuts support Ctrl+Alt with a letter, number, Space, or F1–F11.".into()),
                });
            }
        }
    }
    if modifiers & 6 != 6 {
        return Err("Launch shortcuts require Ctrl+Alt (Shift is optional).".into());
    }
    Ok((modifiers << 8) | key.ok_or("Choose a key with Ctrl+Alt.")?)
}

static APPLIED: Mutex<Option<String>> = Mutex::new(None);

pub fn sync(accelerator: Option<&str>) -> Result<(), String> {
    let mut applied = APPLIED.lock().map_err(|e| e.to_string())?;
    let desired = accelerator.unwrap_or("");
    if applied.as_deref() == Some(desired) {
        return Ok(());
    }
    #[cfg(windows)]
    windows_link::update(accelerator)?;
    #[cfg(not(windows))]
    if accelerator.is_some() {
        return Err("Launch shortcuts are only available on Windows.".into());
    }
    *applied = Some(desired.to_owned());
    Ok(())
}

#[cfg(windows)]
mod windows_link {
    use std::path::{Path, PathBuf};
    use windows::core::{Interface, HSTRING, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, IPersistFile,
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{
        FOLDERID_Programs, IShellLinkW, SHChangeNotify, SHGetKnownFolderPath, ShellLink,
        KF_FLAG_DEFAULT, SHCNE_CREATE, SHCNE_DELETE, SHCNE_UPDATEITEM, SHCNF_FLUSH, SHCNF_PATHW,
    };

    struct Apartment;

    fn scheduler(args: &[&str]) -> Result<std::process::Output, String> {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(scheduler_path()?)
            .args(args)
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())
    }

    fn scheduler_path() -> Result<PathBuf, String> {
        Ok(
            PathBuf::from(std::env::var_os("SystemRoot").ok_or("Windows directory unavailable")?)
                .join("System32")
                .join("schtasks.exe"),
        )
    }

    fn register_task(exe: &Path) -> Result<(), String> {
        use std::io::{Read, Write};
        use std::os::windows::fs::OpenOptionsExt;
        use std::os::windows::process::CommandExt;
        let identity = std::process::Command::new(scheduler_path()?.with_file_name("whoami.exe"))
            .args(["/user", "/fo", "csv", "/nh"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        if !identity.status.success() {
            return Err("Could not identify the current Windows user".into());
        }
        // The SID is ASCII even when the account name uses the OEM code page.
        let identity = String::from_utf8_lossy(&identity.stdout);
        let user = identity
            .trim()
            .rsplit(',')
            .next()
            .unwrap_or("")
            .trim_matches('"');
        if !user.starts_with("S-1-") {
            return Err("Could not identify the current Windows user".into());
        }
        let xml = super::task_xml(&exe.to_string_lossy(), user);
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "cleanmeter-launch-{}-{nonce}.xml",
            std::process::id()
        ));
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .share_mode(1)
            .open(&path)
            .map_err(|e| e.to_string())?;
        let result = (|| {
            let bytes: Vec<u8> = std::iter::once(0xfeffu16)
                .chain(xml.encode_utf16())
                .flat_map(u16::to_le_bytes)
                .collect();
            file.write_all(&bytes).map_err(|e| e.to_string())?;
            drop(file);
            // schtasks opens with read-only sharing, so release our writer,
            // then hold a read lock and verify the file before registration.
            let mut locked = std::fs::OpenOptions::new()
                .read(true)
                .share_mode(1)
                .open(&path)
                .map_err(|e| e.to_string())?;
            let mut actual = Vec::new();
            locked.read_to_end(&mut actual).map_err(|e| e.to_string())?;
            if actual != bytes {
                return Err("Launch task file changed before registration".into());
            }
            let output = scheduler(&[
                "/Create",
                "/TN",
                super::LAUNCH_TASK,
                "/XML",
                &path.to_string_lossy(),
                "/F",
            ])?;
            if !output.status.success() {
                return Err(format!(
                    "Could not create the launch task: {}",
                    String::from_utf8_lossy(&output.stderr).trim()
                ));
            }
            Ok(())
        })();
        let _ = std::fs::remove_file(path);
        result
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }

    pub fn update(accelerator: Option<&str>) -> Result<(), String> {
        // A fresh STA avoids RPC_E_CHANGED_MODE on Tauri's existing threads.
        let accelerator = accelerator.map(str::to_owned);
        std::thread::spawn(move || -> Result<(), String> {
            unsafe {
                CoInitializeEx(None, COINIT_APARTMENTTHREADED)
                    .ok()
                    .map_err(|e| e.to_string())?;
            }
            let _apartment = Apartment;
            let folder = unsafe { SHGetKnownFolderPath(&FOLDERID_Programs, KF_FLAG_DEFAULT, None) }
                .map_err(|e| e.to_string())?;
            let folder_string = unsafe { folder.to_string() };
            unsafe {
                CoTaskMemFree(Some(folder.0.cast()));
            }
            let link = PathBuf::from(folder_string.map_err(|e| e.to_string())?)
                .join("Cleanmeter Overlay.lnk");
            let existed = link.exists();
            if let Some(ref accelerator) = accelerator {
                let hotkey = super::shell_hotkey(&accelerator)?;
                let exe = std::env::current_exe().map_err(|e| e.to_string())?;
                register_task(&exe)?;
                write_link(&link, &exe, hotkey).map_err(|e| e.to_string())?;
            } else {
                // This task has no logon trigger and is independent of autostart.
                let _ = scheduler(&["/Delete", "/TN", super::LAUNCH_TASK, "/F"]);
                match std::fs::remove_file(&link) {
                    Ok(()) => {}
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
                    Err(e) => return Err(e.to_string()),
                }
            }
            let path = HSTRING::from(link.as_os_str());
            let event = if accelerator.is_none() {
                SHCNE_DELETE
            } else if existed {
                SHCNE_UPDATEITEM
            } else {
                SHCNE_CREATE
            };
            unsafe {
                SHChangeNotify(
                    event,
                    SHCNF_PATHW | SHCNF_FLUSH,
                    Some(path.as_ptr().cast()),
                    None,
                );
            }
            Ok(())
        })
        .join()
        .map_err(|_| "Could not update the launch shortcut".to_string())?
    }

    pub(super) fn write_link(path: &Path, exe: &Path, hotkey: u16) -> windows::core::Result<()> {
        unsafe {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            let scheduler = scheduler_path().map_err(|_| windows::core::Error::from_win32())?;
            link.SetPath(&HSTRING::from(scheduler.as_os_str()))?;
            link.SetArguments(&HSTRING::from(format!(
                "/Run /TN \"{}\"",
                super::LAUNCH_TASK
            )))?;
            link.SetShowCmd(windows::Win32::UI::WindowsAndMessaging::SW_HIDE)?;
            if let Some(parent) = exe.parent() {
                link.SetWorkingDirectory(&HSTRING::from(parent.as_os_str()))?;
            }
            link.SetIconLocation(&HSTRING::from(exe.as_os_str()), 0)?;
            link.SetDescription(&HSTRING::from("Launch Cleanmeter or show/hide the overlay"))?;
            link.SetHotkey(hotkey)?;
            let file: IPersistFile = link.cast()?;
            file.Save(PCWSTR(HSTRING::from(path.as_os_str()).as_ptr()), true)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use windows::Win32::System::Com::STGM_READ;

        #[test]
        fn shell_link_round_trips_launch_arguments_and_hotkey() {
            // Temp is outside Explorer's shortcut folders: this exercises COM
            // persistence without installing a hotkey on the developer's desktop.
            unsafe {
                CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
            }
            let _apartment = Apartment;
            let directory =
                std::env::temp_dir().join(format!("cleanmeter-link-test-{}", std::process::id()));
            std::fs::create_dir_all(&directory).unwrap();
            let path = directory.join("overlay.lnk");
            let exe = std::env::current_exe().unwrap();
            write_link(&path, &exe, 0x0620).unwrap();
            unsafe {
                let link: IShellLinkW =
                    CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).unwrap();
                let file: IPersistFile = link.cast().unwrap();
                file.Load(&HSTRING::from(path.as_os_str()), STGM_READ)
                    .unwrap();
                assert_eq!(link.GetHotkey().unwrap(), 0x0620);
                let mut arguments = [0u16; 128];
                link.GetArguments(&mut arguments).unwrap();
                let end = arguments.iter().position(|&c| c == 0).unwrap();
                assert_eq!(
                    String::from_utf16_lossy(&arguments[..end]),
                    format!("/Run /TN \"{}\"", super::super::LAUNCH_TASK)
                );
                let mut target = [0u16; 1024];
                link.GetPath(&mut target, std::ptr::null_mut(), 0).unwrap();
                let end = target.iter().position(|&c| c == 0).unwrap();
                assert_eq!(
                    std::fs::canonicalize(PathBuf::from(String::from_utf16_lossy(&target[..end])))
                        .unwrap(),
                    std::fs::canonicalize(scheduler_path().unwrap()).unwrap()
                );
            }
            std::fs::remove_file(path).unwrap();
            std::fs::remove_dir(directory).unwrap();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn launch_task_is_on_demand_parallel_and_preserves_quoted_paths() {
        let xml = task_xml(r#"C:\Apps & Tools\Cleanmeter.exe"#, r"PC\User");
        assert!(xml.contains("<Triggers />"));
        assert!(xml.contains("<MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>"));
        assert!(xml.contains("<LogonType>InteractiveToken</LogonType>"));
        assert!(xml.contains("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>"));
        assert!(xml.contains(r"C:\Apps &amp; Tools\Cleanmeter.exe"));
        assert!(xml.contains("<Arguments>--toggle-overlay</Arguments>"));
    }
    #[test]
    fn encodes_shell_modifiers_not_register_hotkey_modifiers() {
        assert_eq!(shell_hotkey("Ctrl+Alt+Space").unwrap(), 0x0620);
        assert_eq!(shell_hotkey("Ctrl+Alt+F10").unwrap(), 0x0679);
        assert_eq!(shell_hotkey("Ctrl+Alt+Shift+KeyC").unwrap(), 0x0743);
        assert_eq!(shell_hotkey("Ctrl+Alt+Digit1").unwrap(), 0x0631);
    }
    #[test]
    fn rejects_unrepresentable_or_incomplete_shortcuts() {
        for key in [
            "",
            "Alt+F10",
            "Super+KeyA",
            "Ctrl+Alt",
            "Ctrl+Alt+F12",
            "Ctrl+Alt+MediaPlayPause",
            "Ctrl+Alt+KeyA+KeyB",
        ] {
            assert!(shell_hotkey(key).is_err(), "{key}");
        }
    }
    #[test]
    fn only_exact_launch_argument_routes_to_overlay() {
        assert!(is_overlay_launch(&[
            "Cleanmeter.exe".into(),
            TOGGLE_ARG.into()
        ]));
        assert!(!is_overlay_launch(&[TOGGLE_ARG.into()]));
        assert!(!is_overlay_launch(&[
            "Cleanmeter.exe".into(),
            "--toggle-overlay=false".into()
        ]));
    }

    #[test]
    fn existing_settings_do_not_enable_launch_shortcuts() {
        let defaults = crate::types::OverlaySettings::default();
        let mut json = serde_json::to_value(defaults).unwrap();
        json.as_object_mut().unwrap().remove("launchWithHotkey");
        let old: crate::types::OverlaySettings = serde_json::from_value(json).unwrap();
        assert!(!old.launch_with_hotkey);
    }
}

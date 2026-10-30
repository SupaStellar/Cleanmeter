// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // AppImage users can invoke the bundled launcher without installing it in PATH.
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::process::CommandExt;
        let mut args = std::env::args_os().skip(1);
        let action = args.next();
        if action.as_deref() == Some(std::ffi::OsStr::new("--diagnose")) {
            if let Err(error) = cleanmeter_lib::linux_diagnostics() {
                eprintln!("{error}");
                std::process::exit(1);
            }
            return;
        }
        if action.as_deref() == Some(std::ffi::OsStr::new("--run")) {
            // Use our compiled-in script, preserving each game argument verbatim.
            let error = std::process::Command::new("sh")
                .arg("-c")
                .arg(include_str!("../linux/cleanmeter-run"))
                .arg("cleanmeter-run")
                .args(args)
                .exec();
            eprintln!("Could not launch game: {error}");
            std::process::exit(1);
        }
    }
    cleanmeter_lib::run()
}

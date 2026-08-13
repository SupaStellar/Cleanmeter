use log::{error, info, warn};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::types::{AppPreferences, OverlaySettings};

/// Serializes the whole save transaction: temp file, rename, backup refresh.
///
/// `save_settings` copies into the in-memory `Mutex` and releases it *before*
/// touching disk, and Tauri runs each non-async `invoke` on its own thread, so
/// two windows saving in the same instant (the overlay persisting a drag while
/// the settings window persists a toggle) otherwise run two write transactions
/// through the same temp path, where one can truncate or rename the other's file
/// out from under it and lose that save.
///
/// Not a reproduced failure. See the note on
/// `concurrent_saves_leave_both_copies_readable` for what would not reproduce
/// and why. Kept because ordering the transaction costs nothing here: a save is
/// a couple of kilobytes and already debounced 300 ms in the frontend, so one
/// lock covering both files has nothing to lose to finer granularity.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub struct SettingsManager {
    settings: Mutex<OverlaySettings>,
    preferences: Mutex<AppPreferences>,
    settings_path: PathBuf,
    preferences_path: PathBuf,
}

impl SettingsManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&app_data_dir).ok();

        let settings_path = app_data_dir.join("settings.json");
        let preferences_path = app_data_dir.join("preferences.json");

        let settings = Self::load_from_file::<OverlaySettings>(&settings_path)
            .unwrap_or_default();
        let preferences = Self::load_from_file::<AppPreferences>(&preferences_path)
            .unwrap_or_default();

        info!("Settings loaded from {:?}", settings_path);

        SettingsManager {
            settings: Mutex::new(settings),
            preferences: Mutex::new(preferences),
            settings_path,
            preferences_path,
        }
    }

    pub fn get_settings(&self) -> OverlaySettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn save_settings(&self, new_settings: OverlaySettings) {
        *self.settings.lock().unwrap() = new_settings.clone();
        Self::save_to_file(&self.settings_path, &new_settings);
    }

    pub fn clear_settings(&self) {
        let defaults = OverlaySettings::default();
        *self.settings.lock().unwrap() = defaults.clone();
        Self::save_to_file(&self.settings_path, &defaults);
    }

    pub fn get_preferences(&self) -> AppPreferences {
        self.preferences.lock().unwrap().clone()
    }

    pub fn save_preferences(&self, new_prefs: AppPreferences) {
        *self.preferences.lock().unwrap() = new_prefs.clone();
        Self::save_to_file(&self.preferences_path, &new_prefs);
    }

    /// Parse a settings file, tolerating a leading UTF-8 BOM. Editing
    /// settings.json by hand in Notepad (or any PowerShell `Set-Content
    /// -Encoding utf8`) prepends one, and `serde_json` rejects it as a syntax
    /// error, which used to mean the whole file was discarded.
    fn parse_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Result<T, String> {
        let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        let content = content.strip_prefix('\u{feff}').unwrap_or(&content);
        serde_json::from_str(content).map_err(|e| e.to_string())
    }

    /// Load the last known-good copy written alongside the primary file.
    fn load_backup<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
        let backup = Self::backup_path(path);
        if !backup.exists() {
            return None;
        }
        match Self::parse_file(&backup) {
            Ok(parsed) => {
                info!("Recovered settings from {:?}", backup);
                Some(parsed)
            }
            Err(e) => {
                error!("Backup {:?} is unreadable too: {}", backup, e);
                None
            }
        }
    }

    fn backup_path(path: &PathBuf) -> PathBuf {
        path.with_extension("json.bak")
    }

    /// Read a settings file, falling back to the backup rather than to
    /// defaults.
    ///
    /// Returning `None` here resets every setting the user has (the callers do
    /// `.unwrap_or_default()`), and the next save then overwrites the original,
    /// so an unreadable file silently destroyed the whole config, which
    /// reads to the user as "my settings don't survive a restart". An
    /// unreadable file is now preserved for inspection instead of being
    /// overwritten, and the backup written by `save_to_file` is tried first.
    fn load_from_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
        if !path.exists() {
            // Missing primary (first run, or it was lost): a backup from a
            // previous run still beats defaults.
            return Self::load_backup(path);
        }
        match Self::parse_file(path) {
            Ok(parsed) => Some(parsed),
            Err(e) => {
                error!("Failed to parse {:?}: {}", path, e);
                let quarantine = path.with_extension("json.corrupt");
                match std::fs::rename(path, &quarantine) {
                    Ok(()) => warn!("Unreadable settings preserved at {:?}", quarantine),
                    Err(e) => error!("Failed to move {:?} aside: {}", path, e),
                }
                Self::load_backup(path)
            }
        }
    }

    /// Fill `tmp`, flush it to disk, then rename it over `dest`.
    ///
    /// `fs::write` truncates the target before writing, so a crash, a power
    /// loss, or `app.exit(0)` from the tray landing mid-write left a partial
    /// file that fails to parse on the next launch. Going through a sibling
    /// temp file means a reader always sees either the old file or the complete
    /// new one, since `rename` maps to `MoveFileEx` with
    /// `MOVEFILE_REPLACE_EXISTING` on Windows. The temp path is reused rather
    /// than made unique so a run that dies mid-write leaves one file that the
    /// next save overwrites, instead of littering the directory.
    fn write_atomically(dest: &PathBuf, tmp: &PathBuf, bytes: &[u8]) -> std::io::Result<()> {
        let fill_tmp = || -> std::io::Result<()> {
            let mut file = std::fs::File::create(tmp)?;
            file.write_all(bytes)?;
            // Flush to disk before the rename, so losing power just after it
            // can't leave a renamed-but-empty file.
            file.sync_all()
        };
        let result = fill_tmp().and_then(|()| std::fs::rename(tmp, dest));
        if result.is_err() {
            let _ = std::fs::remove_file(tmp);
        }
        result
    }

    /// Write a settings file atomically, mirroring it to a backup.
    ///
    /// Both files are written from the same in-memory JSON, never copied off
    /// disk. Refreshing the backup from the *previous* on-disk file instead
    /// meant a primary that could not be quarantined (a locked or read-only
    /// file, see `load_from_file`) was copied over the last known-good backup,
    /// so neither copy was loadable and the config reset after all. It also
    /// leaves the backup one save behind; mirroring means recovery restores the
    /// newest good state rather than the one before it.
    fn save_to_file<T: serde::Serialize>(path: &PathBuf, data: &T) {
        let json = match serde_json::to_string_pretty(data) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize settings: {}", e);
                return;
            }
        };

        // Held for the whole transaction. Recovered from poisoning rather than
        // unwrapped: a panic elsewhere while holding this must not leave the app
        // permanently unable to save.
        let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());

        if let Err(e) = Self::write_atomically(
            path,
            &path.with_extension("json.tmp"),
            json.as_bytes(),
        ) {
            error!("Failed to write {:?}: {}", path, e);
            return;
        }

        let backup = Self::backup_path(path);
        if let Err(e) = Self::write_atomically(
            &backup,
            &path.with_extension("json.bak.tmp"),
            json.as_bytes(),
        ) {
            // The primary landed, so this is not fatal. The backup just stays
            // at whatever earlier state it already held.
            error!("Failed to refresh backup {:?}: {}", backup, e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    // A local shape rather than OverlaySettings: these helpers are generic, and
    // the tests are about the file handling, not the settings schema.
    #[derive(Debug, PartialEq, Serialize, Deserialize)]
    struct Probe {
        value: u32,
    }

    fn scratch(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("cleanmeter-settings-{}-{}", tag, nanos));
        std::fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn reads_a_file_that_starts_with_a_utf8_bom() {
        let path = scratch("bom").join("settings.json");
        std::fs::write(&path, "\u{feff}{\"value\":7}").unwrap();

        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, Some(Probe { value: 7 }));
    }

    #[test]
    fn falls_back_to_the_backup_and_keeps_the_unreadable_file() {
        let path = scratch("corrupt").join("settings.json");
        SettingsManager::save_to_file(&path, &Probe { value: 1 });
        SettingsManager::save_to_file(&path, &Probe { value: 2 });

        // What a crash or power loss mid-write used to leave behind.
        std::fs::write(&path, "{\"value\":").unwrap();

        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(
            loaded,
            Some(Probe { value: 2 }),
            "should recover the newest saved state, not defaults or the save before it"
        );
        assert!(
            path.with_extension("json.corrupt").exists(),
            "the unreadable file should be preserved, not overwritten"
        );
    }

    /// The backup is written from the JSON being saved, never copied off disk,
    /// so an unreadable primary left in place (a quarantine rename that failed
    /// because the file was locked or read-only) cannot overwrite the last
    /// known-good copy and leave nothing to recover from.
    #[test]
    fn an_unreadable_primary_never_reaches_the_backup() {
        let path = scratch("poison").join("settings.json");
        SettingsManager::save_to_file(&path, &Probe { value: 1 });

        // Corrupt the primary and leave it there, as a failed quarantine would.
        std::fs::write(&path, "{\"value\":").unwrap();
        SettingsManager::save_to_file(&path, &Probe { value: 2 });

        let backup: Result<Probe, String> =
            SettingsManager::parse_file(&SettingsManager::backup_path(&path));
        assert_eq!(backup, Ok(Probe { value: 2 }), "backup must stay readable");

        // And the save healed the primary, so both copies are good again.
        std::fs::write(&path, "{\"value\":").unwrap();
        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, Some(Probe { value: 2 }));
    }

    /// Two windows can save in the same instant, each on its own Tauri command
    /// thread, and both write transactions go through one temp path.
    ///
    /// Honest about what this proves: it is a smoke test, not a demonstration of
    /// the race. Removing `WRITE_LOCK` does not make it fail: attempts with
    /// mismatched payload lengths and with payloads inflated to ~768 KB all
    /// still passed, because `sync_all` dominates each save and keeps the
    /// truncate-under-another-writer window from opening. The lock is kept
    /// because it is free and makes the transaction ordered, not because this
    /// catches its absence. What this does catch: a deadlock from nesting the
    /// lock, temp-file litter, and a save that stops mirroring its backup.
    #[test]
    fn concurrent_saves_leave_both_copies_readable() {
        #[derive(Debug, Serialize, Deserialize)]
        struct Padded {
            value: u32,
            pad: String,
        }

        let path = scratch("concurrent").join("settings.json");
        std::thread::scope(|s| {
            for value in 1..=8u32 {
                let path = path.clone();
                s.spawn(move || {
                    let payload = Padded {
                        value,
                        pad: "x".repeat(value as usize * 512),
                    };
                    for _ in 0..40 {
                        SettingsManager::save_to_file(&path, &payload);
                    }
                });
            }
        });

        assert!(
            SettingsManager::parse_file::<Padded>(&path).is_ok(),
            "the primary must be complete JSON, not a mix of two writes"
        );
        let backup = SettingsManager::backup_path(&path);
        assert!(
            SettingsManager::parse_file::<Padded>(&backup).is_ok(),
            "the backup must be complete JSON too"
        );
        assert_eq!(
            std::fs::read(&path).unwrap(),
            std::fs::read(&backup).unwrap(),
            "the backup must mirror the primary, not a different thread's save"
        );
        assert!(!path.with_extension("json.tmp").exists());
        assert!(!path.with_extension("json.bak.tmp").exists());
    }

    #[test]
    fn a_save_round_trips_and_leaves_no_temp_file() {
        let path = scratch("save").join("settings.json");
        SettingsManager::save_to_file(&path, &Probe { value: 42 });

        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, Some(Probe { value: 42 }));
        assert!(!path.with_extension("json.tmp").exists());
        assert!(!path.with_extension("json.bak.tmp").exists());
    }

    #[test]
    fn reports_nothing_when_there_is_nothing_to_recover() {
        let path = scratch("empty").join("settings.json");
        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, None);
    }
}

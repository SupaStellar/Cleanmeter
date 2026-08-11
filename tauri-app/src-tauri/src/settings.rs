use log::{error, info, warn};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::types::{AppPreferences, OverlaySettings};

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
    /// error — which used to mean the whole file was discarded.
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
    /// `.unwrap_or_default()`), and the next save then overwrites the original
    /// — so an unreadable file silently destroyed the whole config, which
    /// reads to the user as "my settings don't survive a restart". An
    /// unreadable file is now preserved for inspection instead of being
    /// overwritten, and the backup written by `save_to_file` is tried first.
    fn load_from_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
        if !path.exists() {
            // Missing primary (first run, or it was lost) — a backup from a
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

    /// Write a settings file atomically, keeping the previous contents as a
    /// backup.
    ///
    /// `fs::write` truncates the target before writing, so a crash, a power
    /// loss, or `app.exit(0)` from the tray landing mid-write left a partial
    /// file that fails to parse on the next launch. Writing to a sibling temp
    /// file and renaming over the target means a reader always sees either the
    /// old file or the complete new one — `rename` maps to `MoveFileEx` with
    /// `MOVEFILE_REPLACE_EXISTING` on Windows.
    fn save_to_file<T: serde::Serialize>(path: &PathBuf, data: &T) {
        let json = match serde_json::to_string_pretty(data) {
            Ok(json) => json,
            Err(e) => {
                error!("Failed to serialize settings: {}", e);
                return;
            }
        };

        let tmp = path.with_extension("json.tmp");
        let write_tmp = || -> std::io::Result<()> {
            let mut file = std::fs::File::create(&tmp)?;
            file.write_all(json.as_bytes())?;
            // Flush to disk before the rename, so losing power just after it
            // can't leave a renamed-but-empty file.
            file.sync_all()
        };
        if let Err(e) = write_tmp() {
            error!("Failed to write {:?}: {}", tmp, e);
            let _ = std::fs::remove_file(&tmp);
            return;
        }

        // Refresh the backup from the copy that is still known to be complete,
        // before the rename replaces it.
        if path.exists() {
            let backup = Self::backup_path(path);
            if let Err(e) = std::fs::copy(path, &backup) {
                error!("Failed to refresh backup {:?}: {}", backup, e);
            }
        }

        if let Err(e) = std::fs::rename(&tmp, path) {
            error!("Failed to replace {:?}: {}", path, e);
            let _ = std::fs::remove_file(&tmp);
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
            Some(Probe { value: 1 }),
            "should recover the backup instead of resetting to defaults"
        );
        assert!(
            path.with_extension("json.corrupt").exists(),
            "the unreadable file should be preserved, not overwritten"
        );
    }

    #[test]
    fn a_save_round_trips_and_leaves_no_temp_file() {
        let path = scratch("save").join("settings.json");
        SettingsManager::save_to_file(&path, &Probe { value: 42 });

        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, Some(Probe { value: 42 }));
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn reports_nothing_when_there_is_nothing_to_recover() {
        let path = scratch("empty").join("settings.json");
        let loaded: Option<Probe> = SettingsManager::load_from_file(&path);
        assert_eq!(loaded, None);
    }
}

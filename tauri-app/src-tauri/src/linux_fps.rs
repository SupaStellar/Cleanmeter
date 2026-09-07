//! Read live MangoHud CSV samples created by cleanmeter-run. This is sampled
//! FPS/frametime, not per-frame capture, so percentile-low recording is omitted.
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

#[derive(Clone, Debug)]
pub struct FpsSample {
    pub app: String,
    pub fps: f32,
    pub frametime: f32,
    pub modified: SystemTime,
}

fn columns(header: &str) -> Option<(usize, usize)> {
    let v: Vec<_> = header.trim().split(',').map(str::trim).collect();
    Some((
        v.iter().position(|s| *s == "fps")?,
        v.iter().position(|s| *s == "frametime")?,
    ))
}
fn values(row: &str, columns: (usize, usize)) -> Option<(f32, f32)> {
    let v: Vec<_> = row.trim().split(',').collect();
    let fps: f32 = v.get(columns.0)?.trim().parse().ok()?;
    let ft: f32 = v.get(columns.1)?.trim().parse().ok()?;
    if !fps.is_finite() || !ft.is_finite() || fps <= 0.0 || ft <= 0.0 {
        return None;
    }
    Some((fps, ft))
}
fn read_sample(path: &Path, now: SystemTime) -> Option<FpsSample> {
    let meta = fs::symlink_metadata(path).ok()?;
    if !meta.file_type().is_file() || meta.len() > 128 * 1024 * 1024 {
        return None;
    }
    let modified = meta.modified().ok()?;
    if now.duration_since(modified).unwrap_or_default() > Duration::from_secs(3) {
        return None;
    }
    let mut f = File::open(path).ok()?;
    let mut header = String::new();
    f.by_ref().take(4096).read_to_string(&mut header).ok()?;
    let cols = header.lines().find_map(columns)?;
    let offset = meta.len().saturating_sub(16384);
    f.seek(SeekFrom::Start(offset)).ok()?;
    let mut tail = String::new();
    f.take(16384).read_to_string(&mut tail).ok()?;
    // A producer may be halfway through a write. Only consume complete rows.
    let end = tail.rfind('\n')?;
    let start = if offset > 0 { tail.find('\n')? + 1 } else { 0 };
    if start >= end {
        return None;
    }
    let (fps, frametime) = tail[start..end]
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .and_then(|l| values(l, cols))?;
    let stem = path.file_stem()?.to_str()?;
    // MangoHud names logs <program>_YYYY-MM-DD_HH-MM-SS.csv.
    let app = if stem.len() > 20 && stem.is_char_boundary(stem.len() - 20) {
        &stem[..stem.len() - 20]
    } else {
        stem
    };
    Some(FpsSample {
        app: app.to_string(),
        fps,
        frametime,
        modified,
    })
}

pub fn samples(root: &Path) -> Vec<FpsSample> {
    let now = SystemTime::now();
    let mut result = vec![];
    let sessions: Vec<PathBuf> = fs::read_dir(root)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .take(128)
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .map(|e| e.path())
        .collect();
    for session in sessions {
        for file in fs::read_dir(session)
            .into_iter()
            .flatten()
            .filter_map(Result::ok)
            .take(64)
        {
            let path = file.path();
            if path.extension().and_then(|s| s.to_str()) != Some("csv")
                || path.to_string_lossy().ends_with("_summary.csv")
            {
                continue;
            }
            if let Some(sample) = read_sample(&path, now) {
                result.push(sample);
            }
        }
    }
    result.sort_by(|a, b| b.modified.cmp(&a.modified));
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn headers_are_not_assumed_to_have_fixed_positions() {
        let c = columns("cpu_load,frametime,fps,elapsed").unwrap();
        assert_eq!(values("30,8.3,120,500", c), Some((120.0, 8.3)));
        assert_eq!(values("0,NaN,120,1", c), None);
        assert_eq!(columns("os,cpu,gpu"), None);
    }
    #[test]
    fn reads_latest_complete_row_and_rejects_stale_logs() {
        let dir = std::env::temp_dir().join(format!(
            "cleanmeter-fps-{}",
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("game_2026-09-07_12-00-00.csv");
        fs::write(
            &p,
            "os,cpu,gpu\nLinux,CPU,GPU\nfps,frametime,elapsed\n60,16.6,100\n120,8.3,200\n999,1",
        )
        .unwrap();
        let sample = read_sample(&p, SystemTime::now()).unwrap();
        assert_eq!(sample.app, "game");
        assert_eq!(sample.fps, 120.0);
        assert!(read_sample(&p, SystemTime::now() + Duration::from_secs(10)).is_none());
        fs::write(&p, "fps,frametime\n60,16.6\n0,0\n").unwrap();
        assert!(
            read_sample(&p, SystemTime::now()).is_none(),
            "a fresh invalid row must not revive old FPS"
        );
        fs::remove_dir_all(dir).unwrap();
    }
}

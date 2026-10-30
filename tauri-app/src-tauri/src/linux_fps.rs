//! Read live MangoHud telemetry and incrementally consume verified per-frame sessions.
use std::{
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

#[derive(Clone, Debug)]
pub struct FpsSample {
    pub path: PathBuf,
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
    if !meta.file_type().is_file() {
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
        path: path.to_path_buf(),
        app: app.to_string(),
        fps,
        frametime,
        modified,
    })
}

/// Incrementally consume complete per-frame records; never infer frames from sampled CSV.
#[derive(Default)]
pub struct FrameReader {
    path: PathBuf,
    offset: u64,
    last_timestamp: Option<f64>,
    cols: Option<(usize, usize)>,
    #[cfg(unix)]
    identity: Option<(u64, u64)>,
}
impl FrameReader {
    pub fn attach(&mut self, path: &Path) -> bool {
        let metadata = fs::metadata(path).ok();
        #[cfg(unix)]
        let identity = {
            use std::os::unix::fs::MetadataExt;
            metadata.as_ref().map(|m| (m.dev(), m.ino()))
        };
        let mut unchanged = self.path == path && self.cols.is_some()
            && metadata.as_ref().is_some_and(|m| m.len() >= self.offset);
        #[cfg(unix)]
        { unchanged = unchanged && identity == self.identity; }
        if unchanged { return false; }
        *self = Self { path: path.to_path_buf(), ..Self::default() };
        #[cfg(unix)]
        { self.identity = identity; }
        if path.parent().is_some_and(|p| p.join("cleanmeter-per-frame").is_file()) {
            if let Ok(mut file) = File::open(path) {
                let mut header = String::new();
                let _ = file.by_ref().take(4096).read_to_string(&mut header);
                self.cols = header.lines().find_map(|line| {
                    let cols: Vec<_> = line.split(',').map(str::trim).collect();
                    Some((cols.iter().position(|v| *v == "elapsed")?, cols.iter().position(|v| *v == "frametime")?))
                });
                self.offset = file.metadata().map(|m| m.len()).unwrap_or(0);
            }
        }
        true
    }
    pub fn drain(&mut self) -> Vec<(f64, f64)> {
        let Some((time_col, frame_col)) = self.cols else { return vec![]; };
        let Ok(mut file) = File::open(&self.path) else { return vec![]; };
        if file.metadata().map(|m| m.len() < self.offset).unwrap_or(true) {
            self.cols = None; return vec![];
        }
        if file.seek(SeekFrom::Start(self.offset)).is_err() { return vec![]; }
        let mut bytes = vec![];
        if file.take(4 * 1024 * 1024).read_to_end(&mut bytes).is_err() { return vec![]; }
        let Some(end) = bytes.iter().rposition(|b| *b == b'\n') else { return vec![]; };
        self.offset += end as u64 + 1;
        let mut frames = vec![];
        for line in String::from_utf8_lossy(&bytes[..end]).lines() {
            let cols: Vec<_> = line.split(',').collect();
            let Some(time) = cols.get(time_col).and_then(|v| v.trim().parse::<f64>().ok()).filter(|v| v.is_finite() && *v >= 0.0) else { continue; };
            let Some(ms) = cols.get(frame_col).and_then(|v| v.trim().parse::<f64>().ok()).filter(|v| v.is_finite() && *v > 0.0) else { continue; };
            if self.last_timestamp.is_some_and(|last| time <= last) { continue; }
            self.last_timestamp = Some(time);
            frames.push((time / 1_000_000.0, ms));
        }
        frames
    }
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
    #[ignore = "requires a live MangoHud game launched by cleanmeter-run"]
    fn live_per_frame_capture() {
        let root = PathBuf::from(std::env::var("CLEANMETER_TEST_FPS_DIR").expect("FPS directory"));
        let sample = samples(&root).into_iter().next().expect("live game");
        let mut reader = FrameReader::default(); reader.attach(&sample.path);
        let mut lows = crate::linux_frame_lows::FrameLows::default();
        let mut count = 0;
        for _ in 0..80 {
            std::thread::sleep(Duration::from_millis(100));
            for (t, ms) in reader.drain() { lows.add(t, ms); count += 1; }
        }
        let (one, point_one) = lows.values();
        println!("frames={count}, one_percent_low={one}, point_one_percent_low={point_one}");
        assert!(count > 100, "must exceed 100ms sampling frequency");
        assert!(one > 0.0 && point_one > 0.0 && point_one <= one);
    }
    #[test]
    fn frame_reader_consumes_each_complete_row_once_and_requires_marker() {
        use std::io::Write;
        let root = std::env::temp_dir().join(format!("cleanmeter-stream-{}", SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("game.csv");
        fs::write(&path, "fps,frametime,elapsed\n").unwrap();
        let mut reader = FrameReader::default(); reader.attach(&path);
        let mut file = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        writeln!(file, "100,10,10000000").unwrap();
        assert!(reader.drain().is_empty());
        fs::write(root.join("cleanmeter-per-frame"), "").unwrap();
        reader = FrameReader::default(); reader.attach(&path);
        write!(file, "100,10,20000000\n100,10,").unwrap();
        assert_eq!(reader.drain(), vec![(20.0,10.0)]);
        assert!(reader.drain().is_empty());
        writeln!(file, "30000000").unwrap();
        assert_eq!(reader.drain(), vec![(30.0,10.0)]);
        writeln!(file, "100,10,30000000\n100,NaN,40000000").unwrap();
        assert!(reader.drain().is_empty());
        drop(file); fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn frame_reader_recovers_from_late_headers_truncation_and_replacement() {
        use std::io::Write;
        let root = std::env::temp_dir().join(format!("cleanmeter-rotation-{}", SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("cleanmeter-per-frame"), "").unwrap();
        let path = root.join("game.csv");
        fs::write(&path, "").unwrap();
        let mut reader = FrameReader::default();
        assert!(reader.attach(&path));
        fs::write(&path, "fps,frametime,elapsed\n").unwrap();
        assert!(reader.attach(&path));
        assert!(!reader.attach(&path));
        let append = |timestamp| {
            let mut file = fs::OpenOptions::new().append(true).open(&path).unwrap();
            writeln!(file, "100,10,{timestamp}").unwrap();
        };
        append(10000000);
        assert_eq!(reader.drain(), vec![(10.0, 10.0)]);
        fs::write(&path, "fps,frametime,elapsed\n").unwrap();
        assert!(reader.attach(&path));
        append(1000000);
        assert_eq!(reader.drain(), vec![(1.0, 10.0)]);
        #[cfg(unix)]
        {
            fs::rename(&path, root.join("old.csv")).unwrap();
            fs::write(&path, "fps,frametime,elapsed\n100,10,1000000\n").unwrap();
            assert!(reader.attach(&path));
            append(2000000);
            assert_eq!(reader.drain(), vec![(2.0, 10.0)]);
        }
        fs::remove_dir_all(root).unwrap();
    }
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

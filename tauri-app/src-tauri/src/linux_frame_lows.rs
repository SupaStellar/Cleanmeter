//! Frame-time statistics matching the Windows live window and recording histogram.
use std::collections::VecDeque;

pub struct FrameLows {
    live: VecDeque<(f64, f64)>,
    buckets: Vec<u64>,
    total: f64,
    mode: u8,
    frozen: (f32, f32),
}
impl Default for FrameLows {
    fn default() -> Self {
        Self { live: VecDeque::new(), buckets: vec![0; 100001], total: 0.0, mode: 2, frozen: (0.0, 0.0) }
    }
}
impl FrameLows {
    pub fn reset(&mut self) {
        self.live.clear();
        if self.total > 0.0 { self.buckets.fill(0); }
        self.total = 0.0;
        if self.mode != 0 { self.frozen = (0.0, 0.0); }
    }
    pub fn set_mode(&mut self, mode: u8) {
        if mode == self.mode { return; }
        if mode == 0 { self.frozen = self.values(); }
        if mode == 1 { self.buckets.fill(0); self.total = 0.0; }
        self.mode = mode;
    }
    pub fn add(&mut self, timestamp_ms: f64, ms: f64) {
        if !timestamp_ms.is_finite() || !ms.is_finite() || ms <= 0.0 { return; }
        self.live.push_back((timestamp_ms, ms));
        while self.live.front().is_some_and(|(t, _)| timestamp_ms - t > 10000.0) || self.live.len() > 16384 {
            self.live.pop_front();
        }
        if self.mode == 1 {
            let bucket = (ms.min(1000.0) * 100.0).round_ties_even() as usize;
            self.buckets[bucket] += 1;
            self.total += bucket as f64 / 100.0;
        }
    }
    pub fn values(&self) -> (f32, f32) {
        if self.mode == 0 { return self.frozen; }
        let compute = |fraction: f64| {
            let mut accumulated = 0.0;
            if self.mode == 1 {
                if self.total < 5000.0 { return 0.0; }
                for (i, count) in self.buckets.iter().enumerate().rev() {
                    accumulated += i as f64 / 100.0 * *count as f64;
                    if accumulated >= self.total * fraction { return (100000.0 / i as f64) as f32; }
                }
            } else {
                let mut frames: Vec<_> = self.live.iter().map(|(_, ms)| *ms).collect();
                let total: f64 = frames.iter().sum();
                if total < 5000.0 && frames.len() < 16384 { return 0.0; }
                frames.sort_by(|a,b| b.total_cmp(a));
                for ms in frames {
                    accumulated += ms;
                    if accumulated >= total * fraction { return (1000.0 / ms) as f32; }
                }
            }
            0.0
        };
        (compute(0.01), compute(0.001))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn time_integral_hitch_matches_windows_and_expires() {
        let mut s = FrameLows::default();
        for i in 0..999 { s.add(i as f64 * 8.0, 8.0); }
        s.add(8000.0, 200.0);
        assert_eq!(s.values(), (5.0, 5.0));
        for i in 0..1400 { s.add(8200.0 + i as f64 * 8.0, 8.0); }
        assert_eq!(s.values(), (125.0, 125.0));
    }
    #[test]
    fn recording_freezes_then_returns_to_live() {
        let mut s = FrameLows::default(); s.set_mode(1);
        for i in 0..1000 { s.add(i as f64 * 10.0, 10.0); }
        s.set_mode(0);
        for i in 0..3000 { s.add(10000.0 + i as f64 * 5.0, 5.0); }
        assert_eq!(s.values(), (100.0,100.0));
        s.set_mode(2); assert_eq!(s.values(), (200.0,200.0));
        s.set_mode(1); assert_eq!(s.values(), (0.0,0.0));
    }
    #[test]
    fn frozen_results_survive_source_expiry_and_replacement() {
        let mut s = FrameLows::default();
        s.set_mode(1);
        for i in 0..600 { s.add(i as f64 * 10.0, 10.0); }
        s.set_mode(0);
        s.reset();
        assert_eq!(s.values(), (100.0, 100.0));
        s.reset();
        for i in 0..1200 { s.add(i as f64 * 5.0, 5.0); }
        assert_eq!(s.values(), (100.0, 100.0));
        s.set_mode(2);
        assert_eq!(s.values(), (200.0, 200.0));
        s.reset();
        assert_eq!(s.values(), (0.0, 0.0));
    }
    #[test]
    fn invalid_frames_and_warmup_do_not_publish() {
        let mut s = FrameLows::default();
        for ms in [f64::NAN, f64::INFINITY, -1.0, 0.0] { s.add(1.0,ms); }
        s.add(2.0,16.0); assert_eq!(s.values(), (0.0,0.0));
    }
}

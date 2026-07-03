// Single source of truth for the overlay gauge size step. Figma sizes sweeps
// (2106:2313, 2526:9002 horizontal; 2169:286, 2526:8590 vertical) show both
// gauges (ring and bar) stepping once with the Stats/value font — never
// continuously: 16px square at value font ≤14, 20px at ≥16. Pill minHeight
// derives from the same step so gauge-less pills (FPS/NET) stay as tall as
// gauge-bearing ones. Keep all three consumers (ProgressRing, ProgressBar,
// Pill) on this helper so the step can't drift between them again.
export function gaugeSize(valueFontSize: number): 16 | 20 {
  return valueFontSize <= 14 ? 16 : 20;
}

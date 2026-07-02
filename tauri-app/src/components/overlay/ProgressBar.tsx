import { getBoundaryColor } from "@/lib/utils";
import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { gaugeSize } from "./gauge-metrics";

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  boundaries?: Boundaries;
}

export function ProgressBar({
  value,
  max,
  label,
  unit,
  boundaries,
}: ProgressBarProps) {
  const valueFontSize = useSettingsStore((s) => s.settings.fontSizeValue ?? 12);
  const labelFontSize = useSettingsStore((s) => s.settings.fontSizeLabel ?? 12);
  const valueFontWeight = useSettingsStore((s) => s.settings.fontWeight ?? 500);
  const labelFontWeight = useSettingsStore((s) => s.settings.labelFontWeight ?? 500);
  // Bar gauge geometry verbatim from Figma — horizontal sizes (2526:9002),
  // vertical sizes (2526:8590), state swatches (2527:10167). The gauge is a
  // FIXED square box the same size as the ring (16 at value font ≤14, 20 at
  // ≥16) so both gauge types occupy identical space and the pill height never
  // shifts when switching ring↔bar:
  //   16 box → 5 bars 16w×2h, gap 1.5 (5·2 + 4·1.5 = 16, fills the box)
  //   20 box → 6 bars 20w×2h, gap 1.5 (6·2 + 5·1.5 = 19.5, centered in the box)
  // Bars are always 2px tall, fully rounded (cornerRadius 110), nominal gap
  // 1.5. The value fills bottom-up (active = boundary color, the rest muted
  // track).
  const size = gaugeSize(valueFontSize);
  const barWidth = size;
  const barToTextGap = size === 16 ? 6 : 8;
  const barCount = size === 16 ? 5 : 6;
  const barHeight = 2;
  const barGap = 1.5;
  // A flex `gap: 1.5` lands bars on half-pixels at 100% Windows scale, and the
  // antialiasing renders ragged, uneven gaps (measured 1/2/1 in real captures).
  // Instead, place each bar absolutely and snap its offset to the device-pixel
  // grid: at 200% scale every gap is exactly Figma's 1.5; at 100% the rounding
  // degrades to a crisp, symmetric 2,1,2,1(,2) — while the box stays exactly
  // 16/20 and the first/last bars stay flush with its edges.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const stackHeight = barCount * barHeight + (barCount - 1) * barGap;
  const stackOffset = (size - stackHeight) / 2; // 0 in the 16 box, 0.25 in the 20 box
  // Clamp keeps the last bar inside the box at fractional scales (e.g. 125%,
  // where cumulative rounding can push it 0.4px past the bottom edge).
  const barTops = Array.from({ length: barCount }, (_, i) =>
    Math.min(snap(stackOffset + i * (barHeight + barGap)), size - barHeight)
  );
  const percentage = Math.min(value / max, 1);
  const filledBars = Math.round(percentage * barCount);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: barToTextGap }}>
      <div
        className="shrink-0"
        style={{ position: "relative", width: barWidth, height: size }}
      >
        {barTops.map((top, i) => {
          // Bottom-up fill: i=0 is the top bar (highest index).
          const barIndex = barCount - 1 - i;
          return (
            <div
              key={i}
              className="rounded-full"
              style={{
                position: "absolute",
                top,
                left: 0,
                height: barHeight,
                width: "100%",
                backgroundColor:
                  barIndex < filledBars ? color : "var(--overlay-track, rgba(255,255,255,0.1))",
              }}
            />
          );
        })}
      </div>
      {/* number→unit stays gap-1 (Figma 4); unit holds at labelFontSize like
          the ring. tabular-nums avoids same-digit jitter. */}
      <div className="flex items-center gap-1" style={{ fontSize: valueFontSize }}>
        <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{unit}</span>
      </div>
    </div>
  );
}

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
  // Bar gauge geometry from Figma — horizontal (2526:9002), vertical
  // (2526:8590), state swatches (2527:10167) — with ONE deliberate deviation:
  // the gap is 1px, not Figma's 1.5px (1.5 can't land on a whole pixel at 100%
  // display scale and blurs the bars; 1px renders crisp). Everything that
  // derives from the gap therefore differs from Figma's 1.5-based numbers, and
  // that is intentional — do NOT "correct" these back to Figma:
  //   Figma (1.5 gap): 16 box, 5 bars → stack 5·2 + 4·1.5 = 16 (fills box)
  //                     20 box, 6 bars → stack 6·2 + 5·1.5 = 19.5 (≈ box)
  //   Ours  (1px gap):  16 box, 5 bars → stack 5·2 + 4·1 = 14 (centered in 16)
  //                     20 box, 6 bars → stack 6·2 + 5·1 = 17 (centered in 20)
  // What still matches Figma exactly: bar size 16w/20w × 2h, box = ring size
  // (16/20) so the pill height never shifts on ring↔bar, cornerRadius 110
  // (fully rounded), bottom-up fill (active = boundary color, rest = track).
  const size = gaugeSize(valueFontSize);
  const barWidth = size;
  const barToTextGap = size === 16 ? 6 : 8;
  const barCount = size === 16 ? 5 : 6;
  const barHeight = 2; // Figma bar thickness (CSS px)
  // Gap LOCKED at 1px (Figma spec is 1.5; see the deviation note above).
  const barGap = 1;
  // Snap the whole stack to the DEVICE-pixel grid so every layer is an
  // identical, fully-solid block (no half-pixel blur). The box stays the Figma
  // gauge size (16/20 — same as the ring) so the bar gauge keeps Figma's exact
  // top/bottom breathing room and matches the ring footprint; the shorter 1px
  // stack is centered inside it with an integer offset so it stays crisp.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const sizeDev = Math.round(size * dpr);
  const barWDev = Math.round(barWidth * dpr);
  const barHDev = Math.max(1, Math.round(barHeight * dpr));
  const gapDev = Math.max(1, Math.round(barGap * dpr));
  const stackDev = barCount * barHDev + (barCount - 1) * gapDev;
  const offsetDev = Math.round((sizeDev - stackDev) / 2); // integer → stays crisp
  const barTopsDev = Array.from({ length: barCount }, (_, i) =>
    offsetDev + i * (barHDev + gapDev)
  );
  const boxCss = size;
  const percentage = Math.min(value / max, 1);
  // Whole bars only — each layer is entirely filled or entirely empty track.
  const filledBars = Math.round(percentage * barCount);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: barToTextGap }}>
      {/* viewBox is DEVICE px (barWDev×sizeDev) while the SVG lays out at CSS
          size (barWidth×boxCss), so integer bar coords map 1:1 to physical
          pixels and render crisp. */}
      <svg
        width={barWidth}
        height={boxCss}
        viewBox={`0 0 ${barWDev} ${sizeDev}`}
        className="shrink-0"
      >
        {barTopsDev.map((top, i) => {
          // Bottom-up fill: i=0 is the top bar (highest index).
          const barIndex = barCount - 1 - i;
          return (
            <rect
              key={i}
              x={0}
              y={top}
              width={barWDev}
              height={barHDev}
              // Figma cornerRadius 110 clamps to half the bar height.
              rx={barHDev / 2}
              fill={
                barIndex < filledBars
                  ? color
                  : "var(--overlay-track, rgba(255,255,255,0.1))"
              }
            />
          );
        })}
      </svg>
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

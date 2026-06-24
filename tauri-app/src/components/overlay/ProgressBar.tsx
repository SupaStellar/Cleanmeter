import { getBoundaryColor } from "@/lib/utils";
import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

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
  // Bar geometry verbatim from Figma (2526:9002 / 2526:8590): every bar is 2px
  // tall and fully rounded (cornerRadius 110), stacked with a fixed 1.5px gap —
  // never scaled. The column (and so each bar) is 16px wide at value font ≤14,
  // 20px at ≥16, sitting 6px (16) / 8px (20) from the text. Always 6 bars; the
  // value fills them bottom-up (active = boundary color, the rest muted track).
  const barWidth = valueFontSize <= 14 ? 16 : 20;
  const barToTextGap = barWidth === 16 ? 6 : 8;
  // Figma (node 2527:9744): the gauge is a fixed ~20px block — 6 bars, each 2px
  // tall, 1.5px apart — vertically centered with the text beside it (the row
  // below is align-items:center), like the ring. Bar height is fixed 2px in
  // every combination, never scaling with the font.
  // 1.5px is sub-pixel below 2× scaling, where it renders with uneven gaps. Snap
  // it to the running display's device-pixel grid so every gap is a whole number
  // of device pixels — even and crisp at any Windows scale (and exactly 1.5px at
  // 200%, where 1.5 already lands on 3 device pixels).
  const barCount = 6;
  const barHeight = 2;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const barGap = Math.round(1.5 * dpr) / dpr;
  const percentage = Math.min(value / max, 1);
  const filledBars = Math.round(percentage * barCount);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: barToTextGap }}>
      <div
        className="shrink-0"
        style={{ display: "flex", flexDirection: "column", gap: barGap, width: barWidth }}
      >
        {Array.from({ length: barCount }, (_, i) => {
          // Bottom-up fill: i=0 is the top bar (highest index).
          const barIndex = barCount - 1 - i;
          return (
            <div
              key={i}
              className="rounded-full"
              style={{
                height: barHeight,
                width: "100%",
                backgroundColor:
                  barIndex < filledBars ? color : "var(--overlay-track, rgba(255,255,255,0.15))",
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

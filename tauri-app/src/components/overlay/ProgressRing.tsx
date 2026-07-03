import { getBoundaryColor } from "@/lib/utils";
import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { gaugeSize } from "./gauge-metrics";

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  boundaries?: Boundaries;
}

export function ProgressRing({
  value,
  max,
  label,
  unit,
  boundaries,
}: ProgressRingProps) {
  const valueFontSize = useSettingsStore((s) => s.settings.fontSizeValue ?? 12);
  const labelFontSize = useSettingsStore((s) => s.settings.fontSizeLabel ?? 12);
  const valueFontWeight = useSettingsStore((s) => s.settings.fontWeight ?? 500);
  const labelFontWeight = useSettingsStore((s) => s.settings.labelFontWeight ?? 500);
  // Figma 2106:2313 ring sizing is a step function on fontSizeValue:
  // 16px ring when value font ≤14, 20px ring when ≥16 (shared with the bar
  // gauge and the Pill minHeight floor via gaugeSize).
  const ringSize = gaugeSize(valueFontSize);
  // Ring→value gap steps with the ring per the Figma sweeps (2106:2313
  // clusters): 6 at the 16 ring, 8 at the 20 ring — same as the bar gauge.
  const ringToTextGap = ringSize === 16 ? 6 : 8;
  // Figma draws the ring as an arc with innerRadius 0.7 — a band 15% of the
  // diameter thick: 2.4 at 16, 3 at 20. A flat 3 made the small ring too heavy.
  const strokeWidth = ringSize * 0.15;
  const radius = (ringSize - strokeWidth) / 2;
  const center = ringSize / 2;
  const percentage = Math.min(value / max, 1);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: ringToTextGap }}>
      <svg
        width={ringSize}
        height={ringSize}
        viewBox={`0 0 ${ringSize} ${ringSize}`}
        className="shrink-0"
      >
        {/* Track at 10% per Figma (2106:2313 Ellipse 2, node opacity 0.1) —
            sourced from the same var as the bar track so both gauges and both
            meter themes stay in lockstep. */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--overlay-track, rgba(255,255,255,0.1))"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      {/* Cluster hugs content: cluster→cluster gap reads as the Figma 12px
          (Pill gap); number→unit stays gap-1 (Figma 4). tabular-nums avoids
          same-digit jitter. */}
      <div className="flex items-center gap-1" style={{ fontSize: valueFontSize }}>
        <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{unit}</span>
      </div>
    </div>
  );
}

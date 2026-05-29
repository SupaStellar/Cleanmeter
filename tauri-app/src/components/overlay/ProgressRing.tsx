import { getBoundaryColor } from "@/lib/utils";
import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

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
  // 16px ring when value font ≤14, 20px ring when ≥16.
  const ringSize = valueFontSize <= 14 ? 16 : 20;
  // Ring→value gap is a flat 8 at every size per Figma (node 2106:2313 redline).
  const ringToTextGap = 8;
  const strokeWidth = 3;
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
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--overlay-text)"
          strokeOpacity="0.15"
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

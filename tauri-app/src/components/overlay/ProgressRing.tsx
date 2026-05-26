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
  // Figma 2106:2313 ring sizing is a step function on fontSizeValue:
  // 16px ring when value font ≤14, 20px ring when ≥16. Inner gap follows
  // 6/8. Verified across all 7 size steps; never linear interpolation.
  const ringSize = valueFontSize <= 14 ? 16 : 20;
  const ringToTextGap = valueFontSize <= 14 ? 6 : 8;
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
      <div className="flex items-center gap-1">
        <span style={{ fontSize: valueFontSize, fontWeight: 500, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: 500, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{unit}</span>
      </div>
    </div>
  );
}

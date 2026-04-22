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
  const percentage = Math.min(value / max, 1);
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div className="flex items-center gap-1.5">
      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--overlay-text)"
          strokeOpacity="0.15"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 12 12)"
        />
      </svg>
      <div className="flex items-baseline gap-0.5">
        <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>{unit}</span>
      </div>
    </div>
  );
}

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
  const percentage = Math.min(value / max, 1);
  const filledBars = Math.round(percentage * 10);
  const color = boundaries
    ? getBoundaryColor(value, boundaries)
    : "var(--green-500)";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col gap-[1px] w-6">
        {Array.from({ length: 10 }, (_, i) => {
          const barIndex = 9 - i;
          return (
            <div
              key={i}
              className="h-[2px] w-full rounded-sm"
              style={{
                backgroundColor:
                  barIndex < filledBars ? color : "var(--overlay-track, rgba(255,255,255,0.15))",
              }}
            />
          );
        })}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>{unit}</span>
      </div>
    </div>
  );
}

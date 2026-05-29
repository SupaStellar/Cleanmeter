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
      {/* Cluster hugs content: cluster→cluster gap reads as Figma 12px;
          number→unit stays gap-1 (4px). tabular-nums avoids same-digit jitter. */}
      <div className="flex items-center gap-1" style={{ fontSize: valueFontSize }}>
        <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
          {label}
        </span>
        <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{unit}</span>
      </div>
    </div>
  );
}

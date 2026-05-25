import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";

const CLAMP = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * 3-segment range control from Figma. Defaults to a 0-100% scale (GPU/CPU
 * usage); pass `unit` + `max` to reuse for °C temperatures, watts, etc.
 * Boundaries.low / .medium are the upper bounds of the Low / Medium segments.
 * Boundaries.high is the absolute max.
 */
export function TempRangeControl({
  boundaries,
  onChange,
  unit = "%",
  max = 100,
}: {
  boundaries: Boundaries;
  onChange: (b: Boundaries) => void;
  unit?: string;
  max?: number;
}) {
  const graphEnabled = useSettingsStore(
    (s) => s.settings.progressType !== "none",
  );
  if (!graphEnabled) return null;

  const lowMin = 0;
  const lowMax = boundaries.low;
  const medMin = boundaries.low;
  const medMax = boundaries.medium;
  const highMin = boundaries.medium;
  const highMax = boundaries.high || max;

  const setLowMax = (v: number) => {
    const lv = CLAMP(v, 0, boundaries.medium - 1);
    onChange({ ...boundaries, low: lv });
  };
  const setMedMax = (v: number) => {
    const mv = CLAMP(v, boundaries.low + 1, highMax - 1);
    onChange({ ...boundaries, medium: mv });
  };
  const setHighMax = (v: number) => {
    const hv = CLAMP(v, boundaries.medium + 1, max);
    onChange({ ...boundaries, high: hv });
  };

  return (
    <div className="flex gap-4">
      <RangeSegment color="#17B26A" label="Low" min={lowMin} max={lowMax} unit={unit} inputMax={max} readOnlyMin onMaxChange={setLowMax} />
      <RangeSegment color="#FEC84B" label="Medium" min={medMin} max={medMax} unit={unit} inputMax={max} readOnlyMin onMaxChange={setMedMax} />
      <RangeSegment color="#F04438" label="High" min={highMin} max={highMax} unit={unit} inputMax={max} readOnlyMin onMaxChange={setHighMax} />
    </div>
  );
}

function RangeSegment({
  color,
  label,
  min,
  max,
  unit,
  inputMax,
  readOnlyMin,
  onMaxChange,
}: {
  color: string;
  label: string;
  min: number;
  max: number;
  unit: string;
  inputMax: number;
  readOnlyMin?: boolean;
  onMaxChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </div>
      <div className="flex">
        <ValueInput value={min} unit={unit} inputMax={inputMax} readOnly={readOnlyMin} muted className="rounded-l-[8px]" />
        <ValueInput
          value={max}
          unit={unit}
          inputMax={inputMax}
          onChange={onMaxChange}
          className="-ml-px rounded-r-[8px]"
        />
      </div>
    </div>
  );
}

function ValueInput({
  value,
  unit,
  inputMax,
  onChange,
  readOnly,
  muted,
  className,
}: {
  value: number;
  unit: string;
  inputMax: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex h-10 flex-1 items-center border border-[var(--borderBolder)] px-3 ${muted ? "bg-sub-card" : "bg-[var(--bgSurfaceRaised)]"} ${className ?? ""}`}
    >
      <input
        type="number"
        min={0}
        max={inputMax}
        value={Number.isFinite(value) ? value : 0}
        readOnly={readOnly}
        onChange={(e) => onChange?.(parseInt(e.target.value || "0", 10))}
        className="w-full bg-transparent text-[14px] font-medium text-foreground outline-none read-only:text-muted-foreground"
      />
      <span className="text-[14px] font-medium text-muted-foreground">{unit}</span>
    </div>
  );
}

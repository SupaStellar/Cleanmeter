import { Info } from "lucide-react";
import type { Boundaries } from "@/lib/types";

const CLAMP = (v: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, v));

/**
 * 3-segment temp range control from Figma GPU Usage / CPU Usage card.
 * Boundaries.low = upper bound of Low segment (= min of Medium).
 * Boundaries.medium = upper bound of Medium segment (= min of High).
 * Boundaries.high = upper bound of High (max). Typically 100.
 */
export function TempRangeControl({
  boundaries,
  onChange,
}: {
  boundaries: Boundaries;
  onChange: (b: Boundaries) => void;
}) {
  const lowMin = 0;
  const lowMax = boundaries.low;
  const medMin = boundaries.low;
  const medMax = boundaries.medium;
  const highMin = boundaries.medium;
  const highMax = boundaries.high || 100;

  const setLowMax = (v: number) => {
    const lv = CLAMP(v, 0, boundaries.medium - 1);
    onChange({ ...boundaries, low: lv });
  };
  const setMedMax = (v: number) => {
    const mv = CLAMP(v, boundaries.low + 1, highMax - 1);
    onChange({ ...boundaries, medium: mv });
  };
  const setHighMax = (v: number) => {
    const hv = CLAMP(v, boundaries.medium + 1, 100);
    onChange({ ...boundaries, high: hv });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        <RangeSegment color="#17B26A" label="Low" min={lowMin} max={lowMax} readOnlyMin onMaxChange={setLowMax} />
        <RangeSegment color="#FEC84B" label="Medium" min={medMin} max={medMax} readOnlyMin onMaxChange={setMedMax} />
        <RangeSegment color="#F04438" label="High" min={highMin} max={highMax} readOnlyMin onMaxChange={setHighMax} />
      </div>
      <div className="flex items-center gap-1">
        <Info className="size-4 text-muted-foreground" strokeWidth={2} />
        <span className="text-[12px] font-medium text-muted-foreground">
          Colors are visible only when the graph is enabled in the style settings
        </span>
      </div>
    </div>
  );
}

function RangeSegment({
  color,
  label,
  min,
  max,
  readOnlyMin,
  onMaxChange,
}: {
  color: string;
  label: string;
  min: number;
  max: number;
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
        <PctInput value={min} readOnly={readOnlyMin} muted className="rounded-l-[8px]" />
        <PctInput
          value={max}
          onChange={onMaxChange}
          className="-ml-px rounded-r-[8px]"
        />
      </div>
    </div>
  );
}

function PctInput({
  value,
  onChange,
  readOnly,
  muted,
  className,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex h-10 flex-1 items-center border border-border px-3 ${muted ? "bg-sub-card" : "bg-card"} ${className ?? ""}`}
    >
      <input
        type="number"
        min={0}
        max={100}
        value={Number.isFinite(value) ? value : 0}
        readOnly={readOnly}
        onChange={(e) => onChange?.(parseInt(e.target.value || "0", 10))}
        className="w-full bg-transparent text-[14px] font-medium text-foreground outline-none read-only:text-muted-foreground"
      />
      <span className="text-[14px] font-medium text-muted-foreground">%</span>
    </div>
  );
}

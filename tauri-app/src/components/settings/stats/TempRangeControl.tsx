import { useRef, useState } from "react";
import type { Boundaries } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import {
  applyBoundary,
  isBoundaryInRange,
  parseBoundaryInput,
  type BoundaryField,
} from "@/lib/boundaries";

/**
 * 3-segment range control from Figma 2759:12231. Each segment is 65 tall: a 17
 * label row, 8, then a 40 pair of cells. Defaults to a 0-100% scale (GPU/CPU
 * usage); pass `isTemperature` + `max` (in °C) to reuse for temperatures.
 * Boundaries.low / .medium are the upper bounds of the Low / Medium segments.
 * Boundaries.high is the absolute max.
 */
export function TempRangeControl({
  boundaries,
  onChange,
  unit = "%",
  max = 100,
  isTemperature = false,
}: {
  boundaries: Boundaries;
  onChange: (b: Boundaries) => void;
  unit?: string;
  max?: number;
  /** Temperature thresholds: label °C/°F per the selected unit and, in
   *  Fahrenheit mode, display + accept °F while storing °C. */
  isTemperature?: boolean;
}) {
  const graphEnabled = useSettingsStore(
    (s) => s.settings.progressType !== "none",
  );
  const temperatureUnit = useSettingsStore((s) => s.settings.temperatureUnit);
  if (!graphEnabled) return null;

  // Boundaries are always STORED and compared in °C (the overlay evaluates
  // raw sensor °C against them). In Fahrenheit mode the inputs display and
  // accept °F and convert per edit — since storage is whole °C, a typed °F
  // value can settle ±1°F away after the round-trip.
  const useF = isTemperature && temperatureUnit === "F";
  const toDisplay = (c: number) => (useF ? Math.round((c * 9) / 5 + 32) : c);
  const fromDisplay = (v: number) => (useF ? Math.round(((v - 32) * 5) / 9) : v);
  const displayUnit = isTemperature ? (useF ? "°F" : "°C") : unit;
  const displayInputMax = toDisplay(max);

  const lowMin = toDisplay(0);
  const lowMax = toDisplay(boundaries.low);
  const medMin = toDisplay(boundaries.low);
  const medMax = toDisplay(boundaries.medium);
  const highMin = toDisplay(boundaries.medium);
  const highMax = toDisplay(boundaries.high || max);

  // Inputs hand over display-scale values; convert to °C first so the ±1
  // segment-gap invariants keep holding in the stored scale.
  //
  // `accepts` is what stops the control fighting the typist. Clamping on every
  // keystroke — which is what this used to do — rewrote the field's text after
  // each key, so the first digit of a two-digit number was snapped to a segment
  // edge and the second digit then appended to a number nobody typed. Typing 40
  // into Medium produced 89, backspacing 80 to 8 sprang it back up, and
  // emptying the field read as 0 and clamped to the minimum. Half-typed values
  // are now simply not stored, and the commit keeps the number that was typed:
  // editing Low or Medium moves whatever is in the way, while High clamps to
  // sit above Medium rather than dragging the thresholds down. See
  // lib/boundaries.ts for why the two directions differ.
  const editor = (field: BoundaryField) => ({
    accepts: (v: number) => isBoundaryInRange(field, fromDisplay(v), boundaries, max),
    live: (v: number) => onChange({ ...boundaries, [field]: fromDisplay(v) }),
    commit: (v: number) => onChange(applyBoundary(field, fromDisplay(v), boundaries, max)),
    // Escape undoes whatever the live path stored during this edit. The value
    // came from the store, so it needs no reordering.
    revert: (v: number) => onChange({ ...boundaries, [field]: fromDisplay(v) }),
  });

  return (
    <div className="flex gap-[var(--spacingM)]">
      <RangeSegment color="#17B26A" label="Low" min={lowMin} max={lowMax} unit={displayUnit} inputMax={displayInputMax} readOnlyMin editor={editor("low")} />
      <RangeSegment color="#FEC84B" label="Medium" min={medMin} max={medMax} unit={displayUnit} inputMax={displayInputMax} readOnlyMin editor={editor("medium")} />
      <RangeSegment color="#F04438" label="High" min={highMin} max={highMax} unit={displayUnit} inputMax={displayInputMax} readOnlyMin editor={editor("high")} />
    </div>
  );
}

interface SegmentEditor {
  /** Can this value be stored as typed, with no other bound moving? */
  accepts: (v: number) => boolean;
  /** Store a value that needs nothing else to move, while the field is focused. */
  live: (v: number) => void;
  /** Store the finished value, moving the neighbouring bounds to suit. */
  commit: (v: number) => void;
  /** Put back the value the field held when it gained focus. */
  revert: (v: number) => void;
}

function RangeSegment({
  color,
  label,
  min,
  max,
  unit,
  inputMax,
  readOnlyMin,
  editor,
}: {
  color: string;
  label: string;
  min: number;
  max: number;
  unit: string;
  inputMax: number;
  readOnlyMin?: boolean;
  editor: SegmentEditor;
}) {
  return (
    <div className="flex flex-1 flex-col gap-[var(--spacingXs)]">
      <div className="flex items-center gap-[var(--spacingXxs)]">
        <span className="size-[6px] shrink-0 rounded-[var(--cornerRound)]" style={{ background: color }} />
        <span className="text-[14px] font-medium leading-[17px] text-foreground">{label}</span>
      </div>
      <div className="flex">
        <ValueInput value={min} unit={unit} inputMax={inputMax} readOnly={readOnlyMin} muted className="rounded-l-[8px]" />
        <ValueInput
          value={max}
          unit={unit}
          inputMax={inputMax}
          editor={editor}
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
  editor,
  readOnly,
  muted,
  className,
}: {
  value: number;
  unit: string;
  inputMax: number;
  editor?: SegmentEditor;
  readOnly?: boolean;
  muted?: boolean;
  className?: string;
}) {
  // The text the user is typing, held only while the field is focused. Null
  // means "show the stored value" — the state the field returns to on commit.
  const [draft, setDraft] = useState<string | null>(null);
  // What the field held when it gained focus, so Escape can undo the values the
  // live path stored while typing.
  const valueOnFocus = useRef(value);
  const text = draft ?? (Number.isFinite(value) ? String(value) : "0");

  const handleChange = (raw: string) => {
    setDraft(raw);
    const typed = parseBoundaryInput(raw);
    if (Number.isFinite(typed) && editor?.accepts(typed)) editor.live(typed);
  };

  const commit = () => {
    if (draft === null) return;
    const typed = parseBoundaryInput(draft);
    // A field left empty or unparseable keeps whatever was stored.
    if (Number.isFinite(typed)) editor?.commit(typed);
    setDraft(null);
  };

  const revert = () => {
    if (draft === null) return;
    editor?.revert(valueOnFocus.current);
    setDraft(null);
  };

  return (
    <div
      className={`flex h-[40px] flex-1 items-center border border-[var(--borderBolder)] px-[var(--spacingS)] ${muted ? "bg-sub-card" : "bg-[var(--bgSurfaceRaised)]"} ${className ?? ""}`}
    >
      <input
        type="number"
        min={0}
        max={inputMax}
        value={text}
        readOnly={readOnly}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { valueOnFocus.current = value; }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          // Escape restores the value the field started with and leaves it
          // focused. Blurring here instead would commit the draft: the onBlur
          // handler runs in the same event, still closed over it.
          if (e.key === "Escape") revert();
        }}
        className="w-full bg-transparent text-[14px] font-medium text-foreground outline-none read-only:text-muted-foreground"
      />
      <span className="text-[14px] font-medium text-muted-foreground">{unit}</span>
    </div>
  );
}

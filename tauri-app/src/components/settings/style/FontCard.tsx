import { CollapsibleCard } from "./CollapsibleCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

// FONT card — Figma 2310:3197. Two rows:
//   [Label]  [size ▾]   [weight ▾]
//   [Stats]  [size ▾]   [weight ▾]
// All three columns share equal flex-1 width; gap-3 horizontally & vertically.

const SIZE_OPTIONS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32] as const;

const WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];

function weightLabel(value: number) {
  return WEIGHT_OPTIONS.find((w) => w.value === value)?.label ?? "Medium";
}

const triggerClasses = cn(
  "h-10 flex-1 rounded-[8px] border-[#CECFD2] bg-card px-3 py-2 font-medium",
  "shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)]",
  "text-[14px] text-[#0C111D] [&_svg]:size-5 [&_svg]:opacity-100",
);

function FontRow({
  label,
  size,
  onSizeChange,
  weight,
  onWeightChange,
}: {
  label: string;
  size: number;
  onSizeChange: (v: number) => void;
  weight: number;
  onWeightChange: (v: number) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <span className="flex-1 text-[14px] font-medium leading-none text-[#0C111D]">
        {label}
      </span>
      <Select
        value={String(size)}
        onValueChange={(v) => onSizeChange(parseInt(v, 10))}
      >
        <SelectTrigger className={triggerClasses}>
          <SelectValue placeholder="Size" />
        </SelectTrigger>
        <SelectContent>
          {SIZE_OPTIONS.map((s) => (
            <SelectItem key={s} value={String(s)}>
              {s}px
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(weight)}
        onValueChange={(v) => onWeightChange(parseInt(v, 10))}
      >
        <SelectTrigger className={triggerClasses}>
          <SelectValue placeholder="Weight">{weightLabel(weight)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WEIGHT_OPTIONS.map((w) => (
            <SelectItem key={w.value} value={String(w.value)}>
              {w.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FontCard() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <CollapsibleCard title="Font">
      <div className="flex flex-col gap-3">
        <FontRow
          label="Label"
          size={settings.fontSizeLabel}
          onSizeChange={(v) => updateSettings({ fontSizeLabel: v })}
          weight={settings.labelFontWeight}
          onWeightChange={(v) => updateSettings({ labelFontWeight: v })}
        />
        <FontRow
          label="Stats"
          size={settings.fontSizeValue}
          onSizeChange={(v) => updateSettings({ fontSizeValue: v })}
          weight={settings.fontWeight}
          onWeightChange={(v) => updateSettings({ fontWeight: v })}
        />
      </div>
    </CollapsibleCard>
  );
}

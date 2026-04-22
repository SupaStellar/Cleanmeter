import { SectionCard } from "@/components/settings/stats/SectionCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * FONT card. Matches Figma 2075:7779. Two rows:
 *   Label  [size ▾]   [weight ▾]
 *   Stats  [size ▾]   [weight ▾]
 *
 * Each row has independent size and weight bindings:
 *   Label → fontSizeLabel + labelFontWeight
 *   Stats → fontSizeValue + fontWeight
 */

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
    <div className="flex items-center gap-3">
      <span className="w-[180px] shrink-0 text-[14px] font-medium text-foreground">
        {label}
      </span>
      <Select
        value={String(size)}
        onValueChange={(v) => onSizeChange(parseInt(v, 10))}
      >
        <SelectTrigger className="h-10 flex-1 rounded-[8px] text-[14px] font-medium">
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
        <SelectTrigger className="h-10 flex-1 rounded-[8px] text-[14px] font-medium">
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
    <SectionCard title="Font">
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
    </SectionCard>
  );
}

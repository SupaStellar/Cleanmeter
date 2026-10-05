import { Select, SelectContent, SelectItem, SelectValue } from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
import { useSettingsStore } from "@/stores/settings-store";
import {
  PIXEL_SHIFT_DISTANCES,
  PIXEL_SHIFT_INTERVALS,
  pixelShiftOptions,
} from "@/lib/pixel-shift";
import { InfoIcon } from "./icons";

const FIELDS = [
  {
    key: "pixelShiftDistance",
    label: "Shift by",
    options: PIXEL_SHIFT_DISTANCES,
    format: (px: number) => `${px}px`,
  },
  {
    key: "pixelShiftInterval",
    label: "Frequency",
    options: PIXEL_SHIFT_INTERVALS,
    format: (seconds: number) => `${seconds / 60}min`,
  },
] as const;

/** Figma 3041:6501: the sunken panel under the Pixel Shift row. */
export function PixelShiftControls() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.updateSettings);
  const { distance, interval } = pixelShiftOptions(settings);
  const values = { pixelShiftDistance: distance, pixelShiftInterval: interval };

  return (
    <div className="flex flex-col gap-[var(--spacingS)] rounded-[var(--cornerL)] bg-[var(--bgSurfaceSunkenSubtler)] p-[var(--spacingM)]">
      <div className="flex items-center gap-[var(--spacingS)]">
        {FIELDS.map(({ key, label, options, format }) => (
          <div key={key} className="flex w-[260px] flex-col gap-[var(--spacingXs)]">
            <span id={`${key}-label`} className="text-[14px] font-medium leading-[17px] text-[var(--textHeading)]">
              {label}
            </span>
            <Select
              value={String(values[key])}
              onValueChange={(v) => update({ [key]: parseInt(v, 10) })}
            >
              <SelectFieldTrigger aria-labelledby={`${key}-label`}>
                <SelectValue />
              </SelectFieldTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {format(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
        <InfoIcon className="size-[16px] shrink-0" />
        <span>Recommended is 3px every 2mins.</span>
      </div>
    </div>
  );
}

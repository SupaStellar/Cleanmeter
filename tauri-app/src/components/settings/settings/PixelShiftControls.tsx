import { Input } from "@/components/shadcn/input";
import { useSettingsStore } from "@/stores/settings-store";
import { boundedInteger, pixelShiftOptions } from "@/lib/pixel-shift";

export function PixelShiftControls() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.updateSettings);
  const { distance, interval } = pixelShiftOptions(settings);
  return (
    <fieldset disabled={!settings.pixelShift} className="flex flex-col gap-[var(--spacingS)] disabled:opacity-50">
      <legend className="sr-only">Pixel Shift controls</legend>
      {([
        ["pixelShiftDistance", "Maximum shift (px)", distance, 20],
        ["pixelShiftInterval", "Move every (seconds)", interval, 60],
      ] as const).map(([key, label, value, max]) => (
        <label key={key} className="flex items-center justify-between gap-[var(--spacingS)] text-body-sm-medium text-[var(--textHeading)]">
          {label}
          <Input key={value} type="number" min={1} max={max} step={1} defaultValue={value}
            className="w-24" aria-label={label}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
            onBlur={(event) => {
              const next = boundedInteger(event.currentTarget.valueAsNumber, 1, max, value);
              event.currentTarget.value = String(next);
              update({ [key]: next });
            }} />
        </label>
      ))}
      <p className="text-body-sm-regular text-[var(--textParagraph1)]">Up to {distance}px in each direction, taking a small step every {interval}s. Your saved overlay position stays unchanged.</p>
    </fieldset>
  );
}

import { SectionCard } from "@/components/settings/stats/SectionCard";
import { Slider } from "@/components/shadcn/slider";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * OPACITY card. Matches Figma 2091:2353 — single slider with a low/high
 * brightness icon on either end. Addresses "Minimize ui" by collapsing the
 * old two-slider setup to the primary overall-opacity control only.
 */

function BrightnessLowIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M7.208 16.667H5a1.667 1.667 0 0 1-1.667-1.667v-2.208l-1.604-1.625a1.667 1.667 0 0 1 0-2.334L3.333 7.208V5c0-.458.167-.851.49-1.177A1.605 1.605 0 0 1 5 3.333h2.208l1.625-1.604a1.667 1.667 0 0 1 2.334 0l1.625 1.604H15c.458 0 .851.167 1.177.49.326.326.49.72.49 1.177v2.208l1.604 1.625a1.667 1.667 0 0 1 0 2.334L16.667 12.79V15c0 .458-.164.851-.49 1.177a1.605 1.605 0 0 1-1.177.49H12.79l-1.625 1.604a1.667 1.667 0 0 1-2.334 0l-1.625-1.604ZM7.917 15 10 17.083 12.083 15H15v-2.917L17.083 10 15 7.917V5h-2.917L10 2.917 7.917 5H5v2.917L2.917 10 5 12.083V15h2.917Z"
      />
    </svg>
  );
}

function BrightnessHighIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M7.208 16.667H5a1.667 1.667 0 0 1-1.667-1.667v-2.208l-1.604-1.625a1.667 1.667 0 0 1 0-2.334L3.333 7.208V5c0-.458.167-.851.49-1.177A1.605 1.605 0 0 1 5 3.333h2.208l1.625-1.604a1.667 1.667 0 0 1 2.334 0l1.625 1.604H15c.458 0 .851.167 1.177.49.326.326.49.72.49 1.177v2.208l1.604 1.625a1.667 1.667 0 0 1 0 2.334L16.667 12.79V15c0 .458-.164.851-.49 1.177a1.605 1.605 0 0 1-1.177.49H12.79l-1.625 1.604a1.667 1.667 0 0 1-2.334 0l-1.625-1.604ZM10 14.167c1.153 0 2.135-.407 2.948-1.22A4.015 4.015 0 0 0 14.167 10a4.015 4.015 0 0 0-1.22-2.948A4.015 4.015 0 0 0 10 5.833a4.015 4.015 0 0 0-2.948 1.22A4.015 4.015 0 0 0 5.833 10c0 1.153.407 2.135 1.22 2.948A4.015 4.015 0 0 0 10 14.167ZM7.917 15 10 17.083 12.083 15H15v-2.917L17.083 10 15 7.917V5h-2.917L10 2.917 7.917 5H5v2.917L2.917 10 5 12.083V15h2.917Z"
      />
    </svg>
  );
}

export function OpacitySlider() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <SectionCard title="Opacity">
      <div className="flex flex-col gap-3">
        <Slider
          value={[settings.opacity]}
          min={0.1}
          max={1}
          step={0.01}
          onValueChange={(v) => updateSettings({ opacity: v[0] })}
        />
        <div className="flex items-center justify-between text-muted-foreground">
          <BrightnessLowIcon className="size-5" />
          <span className="text-[12px] font-medium">
            {Math.round(settings.opacity * 100)}%
          </span>
          <BrightnessHighIcon className="size-5" />
        </div>
      </div>
    </SectionCard>
  );
}

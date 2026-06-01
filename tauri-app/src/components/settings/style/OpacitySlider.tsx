import * as SliderPrimitive from "@radix-ui/react-slider";
import { CollapsibleCard } from "./CollapsibleCard";
import { useSettingsStore } from "@/stores/settings-store";

// OPACITY card — Figma 2310:3456. Continuous slider with decorative tick
// indicators (5 dots + 1 center vertical divider + 5 dots), dark fill,
// 20px white thumb with 2px brand border + soft shadow. Three brightness
// icons span the bottom row at min/mid/max.

function BrightnessEmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2C9.34 2 6.92 3.04 5.13 4.74 3.45 6.51 2 8.81 2 12c0 6 5 10 10 10s10-4 10-10C22 6.48 17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    </svg>
  );
}

function Brightness6Icon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18V6c3.31 0 6 2.69 6 6s-2.69 6-6 6z" />
    </svg>
  );
}

function Brightness7Icon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
    </svg>
  );
}

const TICK_COUNT = 11;

export function OpacitySlider() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const normalized = (settings.opacity - 0.1) / 0.9;
  const thumbStep = normalized * (TICK_COUNT - 1);

  return (
    <CollapsibleCard title="Opacity">
      <div className="flex w-full flex-col items-center gap-3">
        <SliderPrimitive.Root
          value={[settings.opacity]}
          min={0.1}
          max={1}
          step={0.01}
          onValueChange={(v) => updateSettings({ opacity: v[0] })}
          className="relative flex h-5 w-full touch-none select-none items-center"
          aria-label="Opacity"
        >
          <SliderPrimitive.Track className="relative h-2 grow rounded-full bg-[var(--bgSurfaceSunkenSubtle)]">
            <SliderPrimitive.Range className="absolute h-full rounded-full bg-[var(--bgBrand)]" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[10px]">
              {Array.from({ length: TICK_COUNT }).map((_, i) => {
                const isCenter = i === 5;
                const filled = i < thumbStep;
                return (
                  <span
                    key={i}
                    className={
                      isCenter
                        ? "h-[6px] w-px rounded-full"
                        : "size-[2px] rounded-full"
                    }
                    style={{ backgroundColor: filled ? "var(--iconSubtle)" : "var(--bgSurfaceSunken)" }}
                  />
                );
              })}
            </div>
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb
            className="block size-5 rounded-full border-2 border-[var(--borderBrand)] bg-[var(--bgSurfaceRaised)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            style={{ boxShadow: "0px 8px 12px 0px rgba(0,0,0,0.06)" }}
            aria-label="Opacity"
          />
        </SliderPrimitive.Root>
        <div className="flex w-full items-center justify-between text-muted-foreground">
          <BrightnessEmptyIcon className="size-5" />
          <Brightness6Icon className="size-5" />
          <Brightness7Icon className="size-5" />
        </div>
      </div>
    </CollapsibleCard>
  );
}

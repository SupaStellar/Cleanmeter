import { CollapsibleCard } from "./CollapsibleCard";
import { Switch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

// POSITION card — Figma 2310:3112.
//   1. 40×40 outlined drag-pan circle + title/helper text + switch.
//   2. 1px subtle divider.
//   3. 3×2 grid of preset tiles. Selected = 2px brand inset ring + round
//      dark pip; unselected = light gray rounded-square pip.

type Preset = {
  index: number;
  label: string;
  pipClass: string;
};

const PRESETS: Preset[] = [
  { index: 0, label: "Top left", pipClass: "top-1 left-1" },
  { index: 1, label: "Top center", pipClass: "top-1 left-1/2 -translate-x-1/2" },
  { index: 2, label: "Top right", pipClass: "top-1 right-1" },
  { index: 3, label: "Bottom left", pipClass: "bottom-1 left-1" },
  { index: 4, label: "Bottom center", pipClass: "bottom-1 left-1/2 -translate-x-1/2" },
  { index: 5, label: "Bottom right", pipClass: "bottom-1 right-1" },
];

function DragPanIcon({ className }: { className?: string }) {
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
        d="M9.167 10.833H4.896l.917.896a.833.833 0 0 1-1.18 1.18L2.25 10.583a.833.833 0 0 1 0-1.166l2.354-2.355a.833.833 0 1 1 1.188 1.188l-.917.917h4.292V4.875l-.938.938a.833.833 0 1 1-1.187-1.188L9.417 2.25a.833.833 0 0 1 1.166 0l2.375 2.375a.833.833 0 1 1-1.187 1.188l-.938-.938v4.292h4.271l-.917-.896a.833.833 0 0 1 1.188-1.188l2.354 2.355a.833.833 0 0 1 0 1.166l-2.375 2.375a.833.833 0 1 1-1.188-1.187l.917-.917h-4.292v4.271l.896-.917a.833.833 0 1 1 1.209 1.167l-2.354 2.354a.833.833 0 0 1-1.167 0L7.042 15.375a.833.833 0 1 1 1.188-1.188l.937.938v-4.292Z"
      />
    </svg>
  );
}

export function PositionGrid() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { useCustomPosition, positionIndex } = settings;

  return (
    <CollapsibleCard title="Position">
      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bgSurfaceRaised)] text-foreground"
            style={{ boxShadow: "inset 0 0 0 1px var(--borderBold)" }}
          >
            <DragPanIcon className="size-5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[14px] font-medium leading-none text-foreground">
              Use custom position
            </span>
            <span className="text-[14px] font-normal leading-none text-muted-foreground">
              Hold the meter to move around the overlay freely.
            </span>
          </div>
          <Switch
            checked={useCustomPosition}
            onCheckedChange={(v) => updateSettings({ useCustomPosition: v })}
          />
        </div>

        {!useCustomPosition && (
          <>
            <div className="h-px w-full bg-divider" aria-hidden />

            <div className="grid grid-cols-3 gap-3">
              {PRESETS.map((p) => {
                const selected = positionIndex === p.index;
                return (
                  <button
                    key={p.index}
                    type="button"
                    onClick={() => updateSettings({ positionIndex: p.index })}
                    className={cn(
                      "flex h-14 items-center gap-3 overflow-hidden rounded-[8px] bg-[var(--bgSurfaceRaised)] pl-1 pr-3 py-1 text-left",
                      "transition-shadow duration-150 motion-reduce:transition-none",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    )}
                    style={{
                      boxShadow: selected
                        ? "inset 0 0 0 2px var(--borderBrand), 0 4px 8px 0 rgba(0,0,0,0.02)"
                        : "inset 0 0 0 1px var(--borderBold), 0 4px 8px 0 rgba(0,0,0,0.02)",
                    }}
                  >
                    <span className="relative size-12 shrink-0 rounded-[4px] bg-[var(--bgSurfaceSunkenSubtle)]">
                      <span
                        className={cn(
                          "absolute size-2",
                          selected
                            ? "rounded-full bg-foreground"
                            : "rounded-[4px] bg-[var(--bgSurfaceSunken)]",
                          p.pipClass,
                        )}
                      />
                    </span>
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}

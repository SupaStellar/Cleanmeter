import { SectionCard } from "@/components/settings/stats/SectionCard";
import { Switch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * POSITION card.
 * - Compact "Use custom position" switch row (drag-pan icon + title + helper).
 * - Divider.
 * - 3×2 grid of preset tiles; each tile shows a tiny dot inside a 48×48 mini
 *   frame reflecting the preset (top-left, top-center, …, bottom-right).
 *
 * Matches Figma frame 2075:7680 ("Position").
 * Addresses "Minimize this flow" comment — the old X/Y inputs and lock row
 * fold into the single switch; custom dragging happens in the overlay itself.
 */

type Preset = {
  index: number;
  label: string;
  pipClass: string; // where the mini dot sits in the 48×48 tile
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
    <SectionCard title="Position">
      {/* Use custom position row */}
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <DragPanIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-medium text-foreground">
            Use custom position
          </span>
          <span className="text-[13px] text-muted-foreground">
            Hold the meter to move around the overlay freely.
          </span>
        </div>
        <Switch
          checked={useCustomPosition}
          onCheckedChange={(v) => updateSettings({ useCustomPosition: v })}
        />
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-divider" />

      {/* 3×2 preset grid */}
      <div
        className={cn(
          "grid grid-cols-3 gap-3 transition-opacity",
          useCustomPosition && "pointer-events-none opacity-40",
        )}
        aria-disabled={useCustomPosition}
      >
        {PRESETS.map((p) => {
          const selected = !useCustomPosition && positionIndex === p.index;
          return (
            <button
              key={p.index}
              type="button"
              disabled={useCustomPosition}
              onClick={() => updateSettings({ positionIndex: p.index })}
              className={cn(
                "flex h-14 items-center gap-3 rounded-[8px] bg-card p-1 text-left transition-colors",
                "border border-border hover:border-foreground/40",
                selected && "border-2 border-foreground p-[3px]",
                "disabled:cursor-not-allowed",
              )}
            >
              <span className="relative size-12 shrink-0 rounded-[4px] bg-muted">
                <span
                  className={cn(
                    "absolute size-2 rounded-full",
                    selected ? "bg-foreground" : "bg-border",
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
    </SectionCard>
  );
}

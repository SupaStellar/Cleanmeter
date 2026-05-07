import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import { Switch } from "@/components/shadcn/switch";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * POSITION card — Figma 2235:661.
 * Collapsible white card with:
 * - "Use custom position" switch row (drag-pan icon + title + helper).
 * - Divider.
 * - 3×2 grid of preset tiles. Selected = 2px brand border + round brand pip.
 */

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
  const [open, setOpen] = React.useState(true);

  const { useCustomPosition, positionIndex } = settings;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex w-full flex-col gap-5 rounded-[12px] bg-card p-5"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between"
          aria-label={open ? "Collapse Position" : "Expand Position"}
        >
          <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Position
          </span>
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            strokeWidth={2}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
        <div className="flex flex-col gap-5">
          {/* Use custom position row */}
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-card text-muted-foreground">
              <DragPanIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[14px] font-medium leading-none text-foreground">
                Use custom position
              </span>
              <span className="text-[14px] leading-none text-muted-foreground">
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
                    "flex h-14 items-center gap-3 overflow-hidden rounded-[8px] bg-card pl-1 pr-3 py-1 text-left",
                    "border border-border/50 shadow-[0_4px_8px_0_rgba(0,0,0,0.02)]",
                    "transition-colors hover:border-foreground/40 disabled:cursor-not-allowed",
                    selected && "border-2 border-foreground pl-[3px] pr-[11px] py-[3px]",
                  )}
                >
                  <span className="relative size-12 shrink-0 rounded-[4px] bg-[var(--surface-sunken-subtle,#f5f5f6)]">
                    <span
                      className={cn(
                        "absolute size-2",
                        selected ? "rounded-full bg-foreground" : "rounded-full bg-border",
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

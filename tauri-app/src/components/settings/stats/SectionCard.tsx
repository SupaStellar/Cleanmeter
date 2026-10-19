import * as React from "react";
import { playSound } from "@/lib/sound-effects";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/shadcn/switch";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";

/**
 * White section card with an uppercase label + optional right-side switch.
 * Matches Figma cards 2075:5766 (FPS), 2075:5793 (GPU), etc.
 *
 * Padding, gap and radius are px tokens rather than p-5 / gap-5 / rounded-xl:
 * :root sets font-size 14px, so a rem utility lands at 87.5% of its nominal
 * value and the 20 Figma redlines were rendering as 17.5.
 */
export function SectionCard({
  title,
  enabled,
  onToggle,
  children,
  className,
}: {
  title: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex w-full flex-col rounded-[var(--cornerXl)] bg-[var(--bgSurfaceRaised)] p-[var(--spacingL)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase leading-[16px] tracking-wide text-muted-foreground">
          {title}
        </span>
        {onToggle !== undefined && (
          <Switch checked={!!enabled} onCheckedChange={(value) => {
            if (value !== !!enabled) playSound("toggle");
            onToggle(value);
          }} aria-label={title} />
        )}
      </div>
      {/* When the section has a toggle and it's off, hide the body entirely
          to match Figma "Stats / Off" — header row only. Sections without a
          toggle (Monitor) always show their content. */}
      <Disclosure open={onToggle === undefined || !!enabled} variant="panel" className="flex flex-col gap-[var(--spacingL)] pt-[var(--spacingL)]">{children}</Disclosure>
    </section>
  );
}

/**
 * Collapsible sub-card inside a SectionCard.
 * Row: checkbox + label + chevron (toggles open/close).
 * When open, children render below.
 * Matches Figma GPU Usage / CPU Usage / VRAM / RAM expand rows.
 */
export function SubCollapsible({
  label,
  checked,
  onCheckedChange,
  defaultOpen = false,
  expandable = true,
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  defaultOpen?: boolean;
  // When false, renders a flat row with no chevron and no expand panel —
  // used when the expanded content would otherwise be empty (e.g. RAM Usage
  // with graphs disabled has nothing to show below the row).
  expandable?: boolean;
  children?: React.ReactNode;
}) {
  // toArray drops the falsy children a `cond && <X/>` leaves behind, so a
  // row whose blocks are all hidden (no sensor picker, graphs off) renders
  // flat instead of an empty rail behind a chevron.
  const blocks = React.Children.toArray(children);
  const canExpand = expandable && blocks.length > 0;
  const [open, setOpen] = React.useState(defaultOpen && checked && canExpand);
  // Collapse automatically when the sensor is unchecked; the expanded detail
  // is only meaningful when the sensor is active.
  React.useEffect(() => {
    if (!checked && open) setOpen(false);
  }, [checked, open]);
  // Also collapse if the row becomes non-expandable so state doesn't get stuck.
  React.useEffect(() => {
    if (!canExpand && open) setOpen(false);
  }, [canExpand, open]);

  if (!canExpand) {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          aria-label={label}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          aria-label={label}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <span className="text-[14px] font-medium text-foreground">{label}</span>
        <CollapsibleTrigger asChild>
          {/* Chevron pairs with the panel animation: same ease-out-quart,
              same 200ms (paired elements move as a unit). */}
          <button
            type="button"
            className="ml-auto flex size-5 items-center justify-center rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          >
            <ChevronDown className="t-acc-chevron size-[18px]" strokeWidth={2} />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-[var(--spacingXs)]">
        {/* Figma 2759:12229: a 2px rail 12 in from the left, then the blocks
            20 across from it, stacked 12 apart. */}
        <div className="flex gap-[var(--spacingL)] pl-[var(--spacingS)]">
          <div className="w-[2px] shrink-0 rounded-[var(--cornerRound)] bg-[var(--borderSubtle)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacingS)]">
            {/* One card per block, not one card around all of them: the
                design separates the sensor picker from the threshold row. */}
            {blocks.map((child, i) => (
              <SubCard key={i}>{child}</SubCard>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * One block inside an expanded SubCollapsible.
 *
 * Figma 2759:12490 / 2759:12231: radius 8, 16 all round, Bg/Surface Sunken
 * Subtler. Gap 16 is the threshold row's; the picker card holds a single child
 * so its own 6 never shows.
 */
function SubCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--spacingM)] rounded-[var(--cornerL)] bg-[var(--bgSurfaceSunkenSubtler)] p-[var(--spacingM)]">
      {children}
    </div>
  );
}

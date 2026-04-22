import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/shadcn/switch";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";

/**
 * White section card with an uppercase label + optional right-side switch.
 * Matches Figma cards 2075:5766 (FPS), 2075:5793 (GPU), etc.
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
        "flex w-full flex-col gap-5 rounded-[12px] bg-card p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {onToggle !== undefined && (
          <Switch checked={!!enabled} onCheckedChange={onToggle} />
        )}
      </div>
      {children}
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
  children,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen && checked);
  // Collapse automatically when the sensor is unchecked; the expanded detail
  // is only meaningful when the sensor is active.
  React.useEffect(() => {
    if (!checked && open) setOpen(false);
  }, [checked, open]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <span className="text-[14px] font-medium text-foreground">{label}</span>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="ml-auto flex size-5 items-center justify-center text-muted-foreground transition-transform data-[state=open]:rotate-180"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className="size-[18px]" strokeWidth={2} />
          </button>
        </CollapsibleTrigger>
      </div>
      {children && (
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
          <div className="flex gap-5 pl-3">
            <div className="w-[2px] shrink-0 rounded-full bg-divider" />
            <div className="flex-1 rounded-[8px] bg-sub-card p-4">
              {children}
            </div>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

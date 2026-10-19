import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/ui/Disclosure";

export function CollapsibleCard({title, defaultOpen = true, open: openProp, rightControl, children, bodyClassName}: {
  title: string; defaultOpen?: boolean; open?: boolean; rightControl?: React.ReactNode;
  children: React.ReactNode; bodyClassName?: string;
}) {
  const controlled = openProp !== undefined;
  const [openState, setOpen] = React.useState(defaultOpen);
  const open = controlled ? openProp : openState;
  const contentId = React.useId();
  return (
    <div data-open={open} className="t-acc flex w-full flex-col rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        {rightControl}
        {!controlled && <button type="button" onClick={() => setOpen(o => !o)}
          aria-expanded={open} aria-controls={contentId} aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="flex items-center justify-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown className="t-acc-chevron size-5" strokeWidth={2} />
        </button>}
      </div>
      <Disclosure id={contentId} open={open} variant={controlled ? "panel" : "accordion"}
        className={cn("pt-5", bodyClassName)}>{children}</Disclosure>
    </div>
  );
}

import * as React from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/shadcn/collapsible";
import { cn } from "@/lib/utils";

// White section card with uppercase title, optional right-side control
// (e.g. a switch for SHOW GRAPH), and chevron trigger that collapses the
// body. Matches the Figma Style-tab section pattern.
export function CollapsibleCard({
  title,
  defaultOpen = true,
  rightControl,
  children,
  bodyClassName,
}: {
  title: string;
  defaultOpen?: boolean;
  rightControl?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex w-full flex-col gap-5 rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </span>
        {rightControl}
        <CollapsibleTrigger
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="flex items-center justify-center text-muted-foreground"
        >
          <ChevronDown
            className={cn(
              "size-5 transition-transform duration-200 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
            strokeWidth={2}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className={bodyClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

// Stroke geometry supplied by transitions.dev Checkbox check.
function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 10.1668 10.1668"
      fill="none" className={className} aria-hidden>
      <path className="app-checkbox-draw" d="M1 5.52L3.92 9.17L9.17 1"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // 24 box, 19.2 visual: Figma's Checkbox [1.0] instance is 24 square
        // and that is what sets the height of every row it sits in.
        "t-check group flex size-[24px] shrink-0 items-center justify-center outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "t-check-box relative flex size-[19.2px] items-center justify-center rounded-[4px]",
          "bg-[var(--bgSurfaceSunken)] group-data-[state=checked]:bg-[var(--bgBrand)] group-data-[state=indeterminate]:bg-[var(--bgBrand)]",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-1",
        )}
      >
        {/* Unchecked is a 15.6 raised square inside the 19.2 sunken one, which
            is what leaves Figma's 1.8 ring rather than a 1px border. It gives
            way to the check. */}
        <span className="app-checkbox-inset absolute size-[15.6px] rounded-[2.6px] bg-[var(--bgSurfaceRaised)]" />
        <CheckboxPrimitive.Indicator forceMount className="app-checkbox-indicator relative flex items-center justify-center text-[var(--bgSurfaceRaised)]">
          <CheckmarkIcon className="app-checkbox-check" />
          <span className="app-checkbox-mixed absolute h-[2px] w-[10px] rounded-full bg-current" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils";

// Checkmark exported from Figma I2353:501;6914:107495 — native 11×8 viewBox,
// path fills the box edge-to-edge so no off-center bias when centered inside
// the parent. Replaces lucide-react `<Check />` whose 24×24 viewBox carried
// a slight upward shift that was visible at small sizes.
function CheckmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="8"
      viewBox="0 0 11 8"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.8728 1.27279L4.2364 7.90919L0 3.67279L1.27279 2.4L4.2364 5.3636L9.6 0L10.8728 1.27279Z"
        fill="currentColor"
      />
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
        "group flex size-[24px] shrink-0 items-center justify-center outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "relative flex size-[19.2px] items-center justify-center rounded-[4px]",
          "bg-[var(--bgSurfaceSunken)] group-data-[state=checked]:bg-[var(--bgBrand)]",
          "transition-colors duration-150 motion-reduce:transition-none",
          "group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-1",
        )}
      >
        {/* Unchecked is a 15.6 raised square inside the 19.2 sunken one, which
            is what leaves Figma's 1.8 ring rather than a 1px border. It gives
            way to the check. */}
        <span className="absolute size-[15.6px] rounded-[2.6px] bg-[var(--bgSurfaceRaised)] group-data-[state=checked]:hidden" />
        <CheckboxPrimitive.Indicator className="relative flex items-center justify-center text-[var(--bgSurfaceRaised)]">
          <CheckmarkIcon />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

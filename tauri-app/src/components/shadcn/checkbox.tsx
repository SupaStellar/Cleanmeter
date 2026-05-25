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
        "peer size-[18px] shrink-0 rounded-[4px] border border-[var(--bgSurfaceSunken)] bg-[var(--bgSurfaceRaised)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <CheckmarkIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };

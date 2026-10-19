import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

// 36x20 track with a 16 knob and 2 of padding, per Figma. The travel is
// 36 - 2 - 2 - 16 = 16.

function Switch({
  className,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const thumbRef = React.useRef<HTMLSpanElement>(null);
  const [interacted, setInteracted] = React.useState(false);
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "t-toggle peer inline-flex h-[20px] w-[36px] shrink-0 items-center rounded-full p-[2px] outline-none",
        interacted && "is-init",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-success data-[state=unchecked]:bg-[var(--bgSurfaceSunken)]",
        className,
      )}
      {...props}
      onCheckedChange={(checked) => {
        const thumb = thumbRef.current;
        if (thumb) {
          // Retarget the snippet from the visible position on rapid reversals.
          const current = parseFloat(getComputedStyle(thumb).translate) || 0;
          thumb.style.setProperty("--toggle-from", `${current}px`);
        }
        setInteracted(true);
        onCheckedChange?.(checked);
      }}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        ref={thumbRef}
        onAnimationEnd={(event) => event.currentTarget.style.removeProperty("--toggle-from")}
        className={cn(
          "t-toggle-thumb pointer-events-none block size-[16px] rounded-full bg-white shadow-sm",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

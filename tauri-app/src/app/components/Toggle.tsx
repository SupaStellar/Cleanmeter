import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-[2px] transition-colors duration-150 shadow-focus-default",
  {
    variants: {
      checked: {
        false: "bg-[var(--bgSurfaceSunken)]",
        true: "bg-[var(--bgSuccessActive)]",
      },
      disabled: {
        true: "cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      checked: false,
      disabled: false,
    },
  }
);

type ToggleProps = Omit<React.ComponentProps<"button">, "onChange"> &
  VariantProps<typeof toggleVariants> & {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  };

function Toggle({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  disabled,
  onCheckedChange,
  ...props
}: ToggleProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  function handleClick() {
    if (disabled) return;
    const next = !checked;
    if (!isControlled) setInternalChecked(next);
    onCheckedChange?.(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled ?? undefined}
      className={cn(toggleVariants({ checked, disabled }), className)}
      onClick={handleClick}
      {...props}
    >
      {/* Thumb */}
      <span
        className={cn(
          "pointer-events-none size-4 shrink-0 rounded-full bg-[var(--bgSurfaceRaised)] shadow-[0px_4px_8px_0px_rgba(0,0,0,0.02)] transition-transform duration-150",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Toggle, toggleVariants };

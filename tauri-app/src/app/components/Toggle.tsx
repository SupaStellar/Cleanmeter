import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-[96px] border-t px-[2.8px] transition-colors duration-150 shadow-focus-default",
  {
    variants: {
      checked: {
        false:
          "border-[var(--borderBolder)] bg-[var(--bgSurfaceSunken)] shadow-[inset_0px_4px_4px_0px_rgba(15,15,16,0.06)]",
        true:
          "border-[var(--borderSuccessDarker)] bg-[var(--bgSuccessHover)]",
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
          "pointer-events-none size-[14.4px] shrink-0 rounded-[56px] border border-white bg-[var(--bgSurfaceOverlay)] shadow-[0px_6px_10px_0px_rgba(22,38,100,0.08),0px_4px_8px_0px_rgba(22,38,100,0.08),0px_2px_4px_0px_rgba(22,38,100,0.08),inset_0px_-3px_3px_0px_#e4e5e7] transition-transform duration-150",
          checked ? "translate-x-[14.2px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Toggle, toggleVariants };

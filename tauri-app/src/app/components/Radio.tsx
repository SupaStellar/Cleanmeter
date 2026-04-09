import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const radioVariants = cva(
  "inline-flex cursor-pointer items-center shadow-focus-default",
  {
    variants: {
      disabled: {
        true: "cursor-not-allowed opacity-50",
      },
    },
    defaultVariants: {
      disabled: false,
    },
  }
);

type RadioProps = Omit<React.ComponentProps<"button">, "onChange"> &
  VariantProps<typeof radioVariants> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    label?: string;
  };

function Radio({
  className,
  checked = false,
  disabled,
  onCheckedChange,
  label,
  ...props
}: RadioProps) {
  function handleClick() {
    if (disabled) return;
    onCheckedChange?.(!checked);
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled ?? undefined}
      className={cn(radioVariants({ disabled }), label && "gap-[var(--spacingXs)]", className)}
      onClick={handleClick}
      {...props}
    >
      {/* 24px hit area wrapping the visible 19.2px ring */}
      <span className="pointer-events-none inline-flex size-6 shrink-0 items-center justify-center">
        <span
          className={cn(
            "inline-flex size-[19.2px] items-center justify-center rounded-full",
            checked
              ? "bg-[var(--bgBrand)]"
              : "bg-[var(--bgSurfaceSunken)]"
          )}
        >
          <span
            className={cn(
              "rounded-full bg-[var(--bgSurfaceRaised)]",
              checked
                ? "size-[9.6px] border border-white"
                : "size-[15px] shadow-[0px_2px_2px_0px_rgba(27,28,29,0.12)]"
            )}
          />
        </span>
      </span>
      {label && (
        <span className="text-body-sm-medium text-[var(--textHeading)]">
          {label}
        </span>
      )}
    </button>
  );
}

export { Radio, radioVariants };

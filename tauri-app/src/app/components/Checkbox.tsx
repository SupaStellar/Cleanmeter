import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const checkboxVariants = cva(
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

type CheckboxProps = Omit<React.ComponentProps<"button">, "onChange"> &
  VariantProps<typeof checkboxVariants> & {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    label?: string;
  };

function Checkbox({
  className,
  checked: controlledChecked,
  defaultChecked = false,
  disabled,
  onCheckedChange,
  label,
  ...props
}: CheckboxProps) {
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
      role="checkbox"
      aria-checked={checked}
      disabled={disabled ?? undefined}
      className={cn(checkboxVariants({ disabled }), label && "gap-[var(--spacingXs)]", className)}
      onClick={handleClick}
      {...props}
    >
      {/* 24px hit area wrapping the visible 19.2px checkbox */}
      <span className="pointer-events-none inline-flex size-6 shrink-0 items-center justify-center">
        <span
          className={cn(
            "inline-flex size-[19.2px] items-center justify-center overflow-clip rounded-[4px]",
            checked
              ? "bg-[var(--bgBrand)]"
              : "bg-[var(--bgSurfaceSunken)]"
          )}
        >
          {checked ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[var(--bgSurfaceRaised)]"
            >
              <path
                d="M11.6667 3.5L5.25 9.91667L2.33333 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span className="size-[15px] rounded-[2.6px] bg-[var(--bgSurfaceRaised)] shadow-[0px_2px_2px_0px_rgba(27,28,29,0.12)]" />
          )}
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

export { Checkbox, checkboxVariants };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Dot icon for the label                                             */
/* ------------------------------------------------------------------ */
function Dot({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width="6"
      height="6"
      viewBox="0 0 6 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Input field variants                                               */
/* ------------------------------------------------------------------ */
const inputWrapperVariants = cva(
  [
    "flex w-full items-stretch",
    "rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)]",
    "border transition-shadow",
    "has-[:focus]:border-[var(--borderBrand)]",
  ].join(" "),
  {
    variants: {
      error: {
        false: [
          "border-[var(--borderBolder)]",
          "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
          "has-[:focus]:shadow-[0px_0px_0px_3px_var(--gray300),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        ].join(" "),
        true: [
          "border-[var(--iconDanger)]",
          "has-[:focus]:border-[var(--iconDanger)]",
          "has-[:focus]:shadow-[0px_0px_0px_3px_#FFE2E2]",
        ].join(" "),
      },
      disabled: {
        true: [
          "border-[var(--borderSubtle)]",
          "shadow-none",
          "has-[:focus]:border-[var(--borderSubtle)]",
          "has-[:focus]:shadow-none",
        ].join(" "),
      },
    },
    defaultVariants: {
      error: false,
      disabled: false,
    },
  }
);

/* ------------------------------------------------------------------ */
/*  InputLabel                                                         */
/* ------------------------------------------------------------------ */
function InputLabel({
  className,
  dotColor,
  children,
  ...props
}: React.ComponentProps<"label"> & { dotColor?: string }) {
  return (
    <label
      className={cn(
        "flex items-center gap-[var(--spacingXxs)]",
        className
      )}
      {...props}
    >
      <Dot className="shrink-0" style={{ color: dotColor ?? "var(--iconWarning)" }} />
      <span className="text-body-sm-medium text-[var(--textHeading)]">
        {children}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  InputPrefix                                                        */
/* ------------------------------------------------------------------ */
type PrefixWidth = number | string | "fill";

function InputPrefix({
  className,
  children,
  disabled,
  width,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  disabled?: boolean;
  width?: PrefixWidth;
}) {
  const fill = width === "fill";
  const fixedWidth =
    width !== undefined && !fill
      ? typeof width === "number"
        ? `${width}px`
        : width
      : undefined;

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fill ? "flex-1" : "shrink-0",
        "rounded-l-[var(--cornerL)] border-r",
        "bg-[var(--bgSurfaceSunkenSubtler)]",
        "px-[var(--spacingS)] py-[var(--spacingS)]",
        disabled
          ? "border-[var(--borderSubtle)] text-body-sm-medium text-[var(--textDisabled)]"
          : "border-[var(--borderBolder)] text-body-sm-medium text-[var(--textParagraph2)]",
        className
      )}
      style={{ width: fixedWidth, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */
type InputProps = Omit<React.ComponentProps<"input">, "prefix"> &
  VariantProps<typeof inputWrapperVariants> & {
    label?: string;
    prefix?: React.ReactNode;
    prefixWidth?: PrefixWidth;
    dotColor?: string;
  };

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, prefix, prefixWidth, disabled, id, dotColor, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-[var(--spacingXs)]">
        {label && <InputLabel htmlFor={inputId} dotColor={dotColor}>{label}</InputLabel>}

        <div
          className={cn(
            inputWrapperVariants({
              error,
              disabled: disabled ?? false,
            }),
            className
          )}
        >
          {prefix && (
            <InputPrefix disabled={disabled} width={prefixWidth}>
              {prefix}
            </InputPrefix>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              "min-w-0 flex-1 bg-transparent outline-none",
              "px-[var(--spacingS)] py-[var(--spacingS)]",
              "text-body-sm-regular text-[var(--textHeading)]",
              "[&:not(:placeholder-shown)]:font-[var(--textFontWeightMedium)]",
              "placeholder:text-[var(--textParagraph1)]",
              "disabled:cursor-not-allowed disabled:text-[var(--textDisabled)] disabled:font-[var(--textFontWeightRegular)] disabled:placeholder:text-[var(--textDisabled)]",
              !prefix && "rounded-l-[var(--cornerL)]",
              "rounded-r-[var(--cornerL)]"
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input, InputLabel, InputPrefix, inputWrapperVariants };

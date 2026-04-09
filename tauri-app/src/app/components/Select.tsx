import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  ChevronDown icon (matches Figma's keyboard_arrow_up rotated 180°) */
/* ------------------------------------------------------------------ */
function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.83334 7.91669L10 12.0834L14.1667 7.91669"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Select (root re-export)                                            */
/* ------------------------------------------------------------------ */
const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

/* ------------------------------------------------------------------ */
/*  Trigger                                                            */
/* ------------------------------------------------------------------ */
const selectTriggerVariants = cva(
  [
    "flex h-10 w-full items-center gap-[var(--spacingXs)]",
    "rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)]",
    "px-[var(--spacingS)]",
    "group/trigger border text-body-sm-regular text-[var(--textHeading)]",
    "outline-none transition-shadow",
    "data-[placeholder]:text-[var(--textParagraph1)]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "border-[var(--borderBolder)]",
          "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        
          "focus:border-[var(--borderBrand)] focus:shadow-[0px_0px_0px_3px_var(--gray300),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
          "data-[state=open]:border-[var(--borderBrand)] data-[state=open]:shadow-[0px_0px_0px_3px_var(--gray300),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        ].join(" "),
        disabled: [
          "border-[var(--borderSubtle)]",
          "text-[var(--textDisabled)] cursor-not-allowed",
          "data-[placeholder]:text-[var(--textDisabled)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type SelectTriggerProps = React.ComponentProps<typeof SelectPrimitive.Trigger> &
  VariantProps<typeof selectTriggerVariants> & {
    label?: string;
  };

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, label, variant, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(selectTriggerVariants({ variant }), className)}
    {...props}
  >
    {label && (
      <span className="shrink-0 text-body-sm-regular text-[var(--textParagraph1)]">
        {label}
      </span>
    )}
    <span className="min-w-0 flex-1 truncate text-left font-[var(--textFontWeightMedium)] group-data-[placeholder]/trigger:font-[var(--textFontWeightRegular)]">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="shrink-0 text-[var(--iconSubtler)] group-data-[disabled]/trigger:text-[var(--iconSubtleHover)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/* ------------------------------------------------------------------ */
/*  Content (dropdown)                                                 */
/* ------------------------------------------------------------------ */
const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentProps<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 4, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        [
          "relative z-50 overflow-hidden",
          "rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)]",
          "border border-[var(--borderSubtle)]",
          "py-[var(--spacingXxxs)]",
          "shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=top]:slide-in-from-bottom-2",
        ].join(" "),
        position === "popper" && "w-[var(--radix-select-trigger-width)]",
        className
      )}
      position={position}
      sideOffset={sideOffset}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          position === "popper" && "h-[var(--radix-select-content-available-height)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

/* ------------------------------------------------------------------ */
/*  Item                                                               */
/* ------------------------------------------------------------------ */
const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentProps<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      [
        "group relative flex w-full cursor-pointer select-none items-center",
        "px-[var(--spacingXxxs)]",
        "outline-none",
        "data-[disabled]:pointer-events-none data-[disabled]:text-[var(--textDisabled)]",
      ].join(" "),
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "flex flex-1 items-center gap-[var(--spacingXxs)]",
        "rounded-[var(--cornerM)] p-[var(--spacingXs)]",
        "text-body-sm-medium text-[var(--textHeading)]",
        "group-data-[highlighted]:bg-[var(--bgSurface)]"
      )}
    >
      <SelectPrimitive.ItemText className="flex-1">
        {children}
      </SelectPrimitive.ItemText>
    </div>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/* ------------------------------------------------------------------ */
/*  Label (group label)                                                */
/* ------------------------------------------------------------------ */
const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentProps<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      "px-[var(--spacingS)] py-[var(--spacingXs)] text-body-sm-regular text-[var(--textParagraph2)]",
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

/* ------------------------------------------------------------------ */
/*  Separator                                                          */
/* ------------------------------------------------------------------ */
const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentProps<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("mx-[var(--spacingXxxs)] my-[var(--spacingXxxs)] h-px bg-[var(--borderSubtle)]", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
};

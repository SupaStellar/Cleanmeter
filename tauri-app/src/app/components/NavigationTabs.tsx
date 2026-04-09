import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-[var(--cornerRound)] border transition-colors duration-150 shadow-focus-default",
  {
    variants: {
      active: {
        false:
          "border-[var(--borderBold)] bg-[var(--bgSurfaceRaised)] text-[var(--textParagraph1)]",
        true: "border-[var(--borderBold)] bg-[var(--bgBrand)] text-[var(--textInverse)]",
      },
      iconOnly: {
        false: "gap-[var(--spacingXxxs)] pl-[var(--spacingM)] pr-[var(--spacingL)] py-[var(--spacingS)]",
        true: "px-[var(--spacingL)] py-[var(--spacingS)]",
      },
    },
    defaultVariants: {
      active: false,
      iconOnly: false,
    },
  }
);

type TabProps = React.ComponentProps<"button"> &
  VariantProps<typeof tabVariants> & {
    asChild?: boolean;
  };

function Tab({
  className,
  active,
  iconOnly,
  asChild = false,
  ...props
}: TabProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(tabVariants({ active, iconOnly }), className)}
      {...props}
    />
  );
}

function TabIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-flex size-5 shrink-0 items-center justify-center", className)}
      {...props}
    />
  );
}

function TabLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      className={cn("whitespace-nowrap text-body-md-medium", className)}
      {...props}
    />
  );
}

function NavigationTabs({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"nav"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "nav";
  return (
    <Comp
      className={cn("flex items-center justify-between", className)}
      {...props}
    />
  );
}

function NavigationTabsGroup({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn("flex items-center gap-[var(--spacingXs)]", className)}
      {...props}
    />
  );
}

export {
  Tab,
  TabIcon,
  TabLabel,
  NavigationTabs,
  NavigationTabsGroup,
  tabVariants,
};

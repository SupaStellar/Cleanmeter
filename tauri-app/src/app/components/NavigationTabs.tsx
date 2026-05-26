import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabVariants = cva(
  "inline-flex flex-1 min-w-0 cursor-pointer items-center justify-center rounded-[var(--cornerRound)] text-body-md-medium transition-colors duration-150 shadow-focus-default",
  {
    variants: {
      active: {
        false:
          "bg-transparent text-[var(--textParagraph1)] [&_[data-tab-icon]]:text-[var(--iconBolderActive)]",
        true: "bg-[var(--bgSurfaceRaised)] text-[var(--textHeading)] drop-shadow-[0px_4px_4px_rgba(0,0,0,0.02)] [&_[data-tab-icon]]:text-[var(--iconBolder)]",
      },
      iconOnly: {
        false:
          "gap-[var(--spacingXxxs)] pl-[var(--spacingM)] pr-[var(--spacingL)] py-[var(--spacingSx)]",
        true: "px-[var(--spacingL)] py-[var(--spacingSx)]",
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
  type,
  ...props
}: TabProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? type : type ?? "button"}
      className={cn(tabVariants({ active, iconOnly }), className)}
      {...props}
    />
  );
}

function TabIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      data-tab-icon=""
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center",
        className
      )}
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
      className={cn("whitespace-nowrap", className)}
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
      className={cn(
        "flex items-center rounded-[var(--cornerRound)] border border-[var(--borderBold)] bg-[var(--bgSubtle)] p-[var(--spacingXxxs)]",
        className
      )}
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
      className={cn("flex flex-1 min-w-0 items-stretch", className)}
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

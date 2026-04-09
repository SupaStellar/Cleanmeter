import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

function ToastBanner({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-[var(--spacingS)] rounded-[var(--cornerRound)] bg-[var(--bgBrand)] px-[var(--spacingM)] py-[14px] shadow-[var(--shadow-large)]",
        className
      )}
      {...props}
    />
  );
}

function ToastBannerIcon({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[var(--cornerRound)] bg-[var(--bgBrandSubtle)] p-[var(--spacingSx)] text-[var(--textInverse)]",
        className
      )}
      {...props}
    />
  );
}

function ToastBannerContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-[var(--spacingXxs)]",
        className
      )}
      {...props}
    />
  );
}

function ToastBannerTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"p"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "p";
  return (
    <Comp
      className={cn(
        "truncate text-body-sm-medium text-[var(--textInverse)]",
        className
      )}
      {...props}
    />
  );
}

function ToastBannerDescription({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"p"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "p";
  return (
    <Comp
      className={cn(
        "truncate text-label-sm-medium text-[var(--textDisabled)]",
        className
      )}
      {...props}
    />
  );
}

function ToastBannerActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-[var(--spacingL)]", className)}
      {...props}
    />
  );
}

export {
  ToastBanner,
  ToastBannerIcon,
  ToastBannerContent,
  ToastBannerTitle,
  ToastBannerDescription,
  ToastBannerActions,
};

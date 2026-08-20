import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

/**
 * The update pill, matched to Figma 2759:11138 / 11446 / 11750 (available,
 * downloading, ready to install).
 *
 * Every value below is read off those nodes: 64 tall from py 12 around a 40
 * chip, padding 12 left and 16 right, gap 12, radius 100 (cornerRound), fill
 * Bg/Brand, and a 0 4 24 #0000003d drop shadow which is exactly --shadow-large.
 *
 * The two text rows set size, weight and leading directly instead of using
 * text-body-sm-medium / text-label-sm-medium. Figma leaves both nodes on AUTO
 * leading, which measures 17 and 15, while those classes apply 16; and because
 * they are plain CSS rather than Tailwind utilities they sit outside the
 * utilities layer, so a leading-[17px] alongside one of them is simply ignored.
 */
function ToastBanner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-[var(--spacingS)] rounded-[var(--cornerRound)] bg-[var(--bgBrand)]",
        "py-[var(--spacingS)] pl-[var(--spacingS)] pr-[var(--spacingM)]",
        "shadow-[var(--shadow-large)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The 40x40 leading chip.
 *
 * Fill is --bgBrandSubtle rather than Figma's literal value. Figma binds this
 * fill to Gray/800, which lives in the Primitives collection and has one mode,
 * while the pill around it is Bg/Brand from Colors, which has Light and Dark.
 * In dark mode the pill flips to #fafafa and Gray/800 does not move, so the
 * chip stays #1f242f and the icon (Icon/Inverse, which does flip, to #0c111d)
 * disappears into it. That is a slip in the design file, not a look to copy.
 *
 * --bgBrandSubtle is the semantic pair for Bg/Brand: #161b26 on the dark pill,
 * #ececed on the light one. In light mode it is one shade off the #1f242f Figma
 * shows, which is the cost of the chip surviving a theme switch.
 */
function ToastBannerIcon({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "flex size-[40px] shrink-0 items-center justify-center rounded-[var(--cornerRound)]",
        "bg-[var(--bgBrandSubtle)] text-[var(--iconInverse)]",
        className,
      )}
      {...props}
    />
  );
}

function ToastBannerContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-[var(--spacingXxs)]", className)}
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
        "truncate text-[14px] font-medium leading-[17px] text-[var(--textInverse)]",
        className,
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
        "truncate text-[12px] font-medium leading-[15px] text-[var(--textDisabled)]",
        className,
      )}
      {...props}
    />
  );
}

/** Gap 16 between the button group and the close control, per Figma. */
function ToastBannerActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center gap-[var(--spacingM)]", className)}
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

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const menuBoxedItemVariants = cva(
  "flex flex-1 items-center justify-center rounded-[var(--cornerRound)] border px-[var(--spacingL)] py-[var(--spacingS)] text-body-md-medium cursor-pointer transition-[background-color,color,border-color,box-shadow] duration-150 whitespace-nowrap",
  {
    variants: {
      active: {
        false: "border-transparent text-[var(--textParagraph1)]",
        true: "bg-[var(--bgSurfaceRaised)] border-[var(--borderBold)] shadow-[var(--shadow-card)] text-[var(--textHeading)]",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

type MenuBoxedItemProps = React.ComponentProps<"button"> &
  VariantProps<typeof menuBoxedItemVariants>;

function MenuBoxedItem({
  className,
  active,
  ...props
}: MenuBoxedItemProps) {
  return (
    <button
      role="tab"
      aria-selected={active === true}
      className={cn(menuBoxedItemVariants({ active }), className)}
      {...props}
    />
  );
}

function MenuBoxed({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center rounded-[var(--cornerRound)] bg-[var(--bgSurfaceSunkenSubtle)] p-[var(--spacingXxxs)]",
        className
      )}
      {...props}
    />
  );
}

export { MenuBoxed, MenuBoxedItem, menuBoxedItemVariants };

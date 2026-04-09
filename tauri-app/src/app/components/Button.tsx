import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center whitespace-nowrap transition-colors duration-150 shadow-focus-default",
  {
    variants: {
      variant: {
        "filled-white":
          "rounded-[var(--cornerRound)] bg-[var(--bgSurfaceRaised)] text-[var(--textHeading)] hover:bg-[var(--bgSurfaceSunken)] active:bg-[var(--bgSurfaceRaised)]",
        "filled-dark":
          "rounded-[var(--cornerRound)] bg-[var(--bgBrand)] text-[var(--textInverse)] hover:bg-[var(--bgBrandHover)] active:bg-[var(--bgBrand)]",
        link: "text-[var(--textInverse)] hover:text-[var(--textParagraph1)] active:text-[var(--textInverse)]",
      },
      size: {
        sm: "px-[var(--spacingL)] py-[var(--spacingS)] text-body-sm-medium",
        md: "h-[54px] px-[var(--spacingXxl)] py-[var(--spacingS)] text-body-md-medium",
      },
    },
    compoundVariants: [
      { variant: "link", size: "sm", className: "px-0 py-0" },
    ],
    defaultVariants: {
      variant: "filled-white",
      size: "sm",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };

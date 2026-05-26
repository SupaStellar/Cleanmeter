import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "flex flex-col items-stretch overflow-clip rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)] shadow-[var(--shadow-card)] cursor-pointer text-left transition-[outline-color,border-color] duration-150 shadow-focus-default",
  {
    variants: {
      active: {
        false: "border border-[var(--borderBold)]",
        true: "border border-transparent outline-2 outline-[var(--borderBrand)]",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

type CardProps = React.ComponentProps<"button"> &
  VariantProps<typeof cardVariants> & {
    asChild?: boolean;
  };

function Card({
  className,
  active,
  asChild = false,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(cardVariants({ active }), className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "relative flex-1 overflow-hidden rounded-[var(--cornerS)] bg-[var(--bgSurfaceSunkenSubtle)] m-[var(--spacingXxxs)]",
        className
      )}
      {...props}
    />
  );
}

function CardFooter({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(
        "flex grow-0 shrink-0 items-center p-[var(--spacingM)]",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"p"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "p";
  return (
    <Comp
      className={cn(
        "min-w-0 flex-1 truncate text-body-sm-medium text-[var(--textHeading)]",
        className
      )}
      {...props}
    />
  );
}

const cardMinimalVariants = cva(
  "flex w-full items-center gap-[var(--spacingS)] overflow-clip rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)] py-[var(--spacingXxxs)] pl-[var(--spacingXxxs)] pr-[var(--spacingS)] text-left shadow-[var(--shadow-card)] cursor-pointer transition-[outline-color,border-color] duration-150 shadow-focus-default",
  {
    variants: {
      active: {
        false: "border border-[var(--borderBold)]",
        true: "border border-transparent outline-2 outline-[var(--borderBrand)]",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

type CardMinimalProps = React.ComponentProps<"button"> &
  VariantProps<typeof cardMinimalVariants> & {
    asChild?: boolean;
    label?: string;
    thumbnail?: React.ReactNode;
  };

function CardMinimal({
  className,
  active,
  asChild = false,
  label,
  thumbnail,
  children,
  ...props
}: CardMinimalProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(cardMinimalVariants({ active }), className)}
      {...props}
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--cornerS)] bg-[var(--bgSurfaceSunkenSubtle)]">
        {thumbnail}
      </span>
      <span className="min-w-0 flex-1 truncate text-body-sm-medium text-[var(--textHeading)]">
        {label ?? children}
      </span>
    </Comp>
  );
}

export {
  Card,
  CardContent,
  CardFooter,
  CardTitle,
  CardMinimal,
  cardVariants,
  cardMinimalVariants,
};

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        // Matches the DS Radio (src/app/components/Radio.tsx): a 24px hit area
        // wrapping the visible 19.2px ring, driven by Radix's data-state.
        "group inline-flex size-6 shrink-0 cursor-pointer items-center justify-center shadow-focus-default focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* 19.2px ring: sunken when unchecked, brand fill when checked */}
      <span className="pointer-events-none inline-flex size-[19.2px] items-center justify-center rounded-full bg-[var(--bgSurfaceSunken)] group-data-[state=checked]:bg-[var(--bgBrand)]">
        {/* unchecked: 15px raised pip with shadow */}
        <span className="size-[15px] rounded-full bg-[var(--bgSurfaceRaised)] shadow-[0px_2px_2px_0px_rgba(27,28,29,0.12)] group-data-[state=checked]:hidden" />
        {/* checked: 9.6px white-bordered dot */}
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <span className="size-[9.6px] rounded-full border border-white bg-[var(--bgSurfaceRaised)]" />
        </RadioGroupPrimitive.Indicator>
      </span>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };

import * as React from "react";
import { cn } from "@/lib/utils";

// Matches the DS Input box (Figma 2488:5967): white surface, 8px radius,
// borderBolder, 12px padding, 0 1px 2px rgba(0,0,0,0.05) shadow, brand focus.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[200px] w-full resize-none rounded-[var(--cornerL)] bg-[var(--bgSurfaceRaised)]",
        "border border-[var(--borderBolder)] px-[var(--spacingS)] py-[var(--spacingS)]",
        "text-body-sm-regular text-[var(--textHeading)] outline-none",
        "shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        "placeholder:text-[var(--textParagraph2)]",
        "[&:not(:placeholder-shown)]:font-[var(--textFontWeightMedium)]",
        "transition-shadow",
        "focus:border-[var(--borderBrand)] focus:shadow-[0px_0px_0px_3px_var(--gray300),0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        "disabled:cursor-not-allowed disabled:text-[var(--textDisabled)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

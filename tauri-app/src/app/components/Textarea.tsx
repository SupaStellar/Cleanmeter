import * as React from "react";
import { cn } from "@/lib/utils";
import { inputWrapperVariants } from "./Input";

// Reuses the DS Input's field shell (border, shadow, brand focus ring via
// has-[:focus]) so the two form controls share one source of truth. The
// textarea itself is bare/transparent and just owns padding + text styling.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, disabled, ...props }, ref) => {
  return (
    <div className={inputWrapperVariants({ error: false, disabled: disabled ?? false })}>
      <textarea
        ref={ref}
        disabled={disabled}
        className={cn(
          "min-h-[200px] w-full resize-none bg-transparent outline-none",
          "px-[var(--spacingS)] py-[var(--spacingS)]",
          "text-body-sm-regular text-[var(--textHeading)]",
          "[&:not(:placeholder-shown)]:font-[var(--textFontWeightMedium)]",
          "placeholder:text-[var(--textParagraph1)]",
          "disabled:cursor-not-allowed disabled:text-[var(--textDisabled)] disabled:font-[var(--textFontWeightRegular)] disabled:placeholder:text-[var(--textDisabled)]",
          className,
        )}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

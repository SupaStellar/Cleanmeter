import * as React from "react";
import { cn } from "@/lib/utils";
import { inputWrapperVariants } from "./Input";

// Reuses the DS Input's field shell (border, shadow, brand focus ring via
// has-[:focus]) so the two form controls share one source of truth. The
// textarea itself is bare/transparent and just owns padding + text styling.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <div className={inputWrapperVariants({ error: false })}>
      <textarea
        ref={ref}
        className={cn(
          "min-h-[200px] w-full resize-none bg-transparent outline-none",
          "px-[var(--spacingS)] py-[var(--spacingS)]",
          "text-body-sm-regular text-[var(--textHeading)]",
          "[&:not(:placeholder-shown)]:font-[var(--textFontWeightMedium)]",
          "placeholder:text-[var(--textParagraph1)]",
          className,
        )}
        {...props}
      />
    </div>
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

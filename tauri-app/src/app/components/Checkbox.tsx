import * as React from "react";
import { Checkbox as AppCheckbox } from "@/components/shadcn/checkbox";
import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.ComponentProps<typeof AppCheckbox>, "onCheckedChange"> & {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
};

/** Labeled adapter; the app primitive owns all checkbox state and motion. */
function Checkbox({ label, className, onCheckedChange, ...props }: CheckboxProps) {
  const control = <AppCheckbox {...props} className={label ? undefined : className}
    onCheckedChange={(checked) => onCheckedChange?.(checked === true)} />;
  return label ? (
    <label className={cn("inline-flex items-center gap-[var(--spacingXs)] text-body-sm-medium text-[var(--textHeading)]", props.disabled ? "cursor-not-allowed" : "cursor-pointer", className)}>
      {control}
      <span className={props.disabled ? "opacity-50" : undefined}>{label}</span>
    </label>
  ) : control;
}
export { Checkbox };

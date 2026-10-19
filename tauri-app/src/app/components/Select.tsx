import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { SelectTrigger as AppSelectTrigger } from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
import { cn } from "@/lib/utils";

export { Select, SelectGroup, SelectValue, SelectContent, SelectItem } from "@/components/shadcn/select";

type TriggerProps = React.ComponentProps<typeof AppSelectTrigger> & {
  label?: string;
  variant?: "default" | "disabled";
};

/** Both forms render the same triggers used by the app. */
export function SelectTrigger({ label, variant, disabled, ...props }: TriggerProps) {
  return label
    ? <SelectFieldTrigger label={label} disabled={disabled || variant === "disabled"} {...props} />
    : <AppSelectTrigger disabled={disabled || variant === "disabled"} {...props} />;
}
export function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn("px-2 py-1 text-sm font-medium text-muted-foreground", className)} {...props} />;
}
export function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}

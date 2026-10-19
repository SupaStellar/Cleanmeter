import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { Disclosure } from "@/components/ui/Disclosure";
import { cn } from "@/lib/utils";

const OpenContext = React.createContext(false);
function Collapsible({open: controlled, defaultOpen = false, onOpenChange, className, children, ...props}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const open = controlled ?? internal;
  return <OpenContext.Provider value={open}>
    <CollapsiblePrimitive.Root {...props} open={open} data-open={open} className={cn("t-acc", className)}
      onOpenChange={next => {setInternal(next); onOpenChange?.(next);}}>
      {children}
    </CollapsiblePrimitive.Root>
  </OpenContext.Provider>;
}
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
function CollapsibleContent({children, className, ...props}: React.ComponentProps<typeof CollapsiblePrimitive.Content>) {
  const open = React.useContext(OpenContext);
  return <CollapsiblePrimitive.Content {...props} forceMount>
    <Disclosure open={open} className={className}>{children}</Disclosure>
  </CollapsiblePrimitive.Content>;
}
export { Collapsible, CollapsibleTrigger, CollapsibleContent };

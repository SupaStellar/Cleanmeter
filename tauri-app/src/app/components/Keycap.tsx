import * as React from "react";
import { cn } from "@/lib/utils";

type KeyEntry = string | { label: string; className?: string };

type KeycapProps = React.ComponentProps<"kbd"> & {
  /** Array of keys — strings or { label, className } for custom sizing */
  keys: KeyEntry[];
};

function Key({
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "relative flex h-8 items-center justify-center overflow-clip rounded-[5px] bg-[var(--bgBrand)] px-[5px] pb-[10px] pt-[8px]",
        className
      )}
      {...props}
    >
      <span className="absolute inset-x-0 top-0 h-[29px] rounded-[5px] bg-gradient-to-b from-[var(--gradientStops1)] from-[11%] to-[var(--gradientStops2)]" />
      <span className="relative text-label-md-regular text-[var(--textInverse)] tracking-[-0.26px]">
        {props.children}
      </span>
    </kbd>
  );
}

function Keycap({ className, keys, ...props }: KeycapProps) {
  return (
    <kbd
      className={cn(
        "flex items-center gap-[var(--spacingXxxs)]",
        className
      )}
      {...props}
    >
      {keys.map((key, i) => {
        const label = typeof key === "string" ? key : key.label;
        const keyClassName = typeof key === "string" ? undefined : key.className;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <span className="text-body-sm-medium text-[var(--textParagraph1)]">
                +
              </span>
            )}
            <Key className={keyClassName}>{label}</Key>
          </React.Fragment>
        );
      })}
    </kbd>
  );
}

export { Keycap, Key };
export type { KeyEntry };

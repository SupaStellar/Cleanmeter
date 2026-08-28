import * as React from "react";
import { cn } from "@/lib/utils";

type KeyEntry = string | { label: string; className?: string };

/**
 * Two keycaps exist in the file and they are not a restyle of one another.
 *
 * `dark` is the original chunky 3D cap (Figma 2075:5744) — 32 tall, gradient
 * body, its own depth edge, and a "+" printed between caps.
 *
 * `light` is the cap inside the shortcut field (Figma 2792:4120 / 4122 /
 * 4124) — 20 tall, white on a 1px Border/Bolder outline, depth carried by a
 * hard `0 2px 0` shadow in the same colour rather than by a gradient, and
 * **no separator**: that frame spaces its caps with gap 4 and prints nothing
 * between them.
 */
type KeycapVariant = "dark" | "light";

type KeycapProps = React.ComponentProps<"kbd"> & {
  /** Array of keys — strings or { label, className } for custom sizing */
  keys: KeyEntry[];
  variant?: KeycapVariant;
};

function Key({
  className,
  variant = "dark",
  ...props
}: React.ComponentProps<"kbd"> & { variant?: KeycapVariant }) {
  if (variant === "light") {
    return (
      <kbd
        className={cn(
          // Figma 2792:4120: pad 2/5, radius 4, fill Bg/Surface Raised,
          // 1px Border/Bolder, drop shadow 0/2/0 spread 0 in that same
          // Border/Bolder — a hard edge, not a blur, so radius 0 is literal.
          "flex items-center justify-center rounded-[var(--cornerS)] bg-[var(--bgSurfaceRaised)] px-[5px] py-[2px]",
          // The outline is an INSET shadow, not a `border`. Figma's stroke
          // align is INSIDE, so its 1px sits within the 20x39 the cap
          // measures; a CSS border is added to the box instead, which grew
          // every cap to 22x41 and — because the field centres its contents —
          // pushed the whole row a pixel off where the frame has it.
          "shadow-[inset_0_0_0_1px_var(--borderBolder),0_2px_0_0_var(--borderBolder)]",
          className,
        )}
        {...props}
      >
        {/* 13/16/-2% is label-md, but the token set only ships its Regular
            weight and the frame's cap text is Medium — hence the one weight
            override on the type class.

            Colour is inherited rather than set: the cap text is Text/Heading
            on the bound board (2792:4121) and Blue/600 while a shortcut is
            being captured (2792:5130), and the box around it does not change
            between those two — so the caller sets the colour on the row and
            both boards fall out of one component. */}
        <span className="text-label-md-regular font-medium text-current">
          {props.children}
        </span>
      </kbd>
    );
  }

  return (
    <kbd
      className={cn(
        "relative flex h-8 items-center justify-center overflow-clip rounded-[5px] bg-[var(--componentKeycapsBg)] px-[5px] pb-[10px] pt-[8px]",
        className
      )}
      {...props}
    >
      <span className="absolute inset-x-0 top-0 h-[29px] rounded-[5px] bg-gradient-to-b from-[var(--componentKeycapsGradientStops1)] from-[11%] to-[var(--componentKeycapsGradientStops2)]" />
      <span className="relative text-label-md-regular text-[var(--componentKeycapsText)] tracking-[-0.26px]">
        {props.children}
      </span>
    </kbd>
  );
}

function Keycap({ className, keys, variant = "dark", ...props }: KeycapProps) {
  return (
    <kbd
      className={cn(
        "flex items-center gap-[var(--spacingXxxs)]",
        // Light caps inherit their text colour from here, so this is the one
        // place a caller overrides to get the Blue/600 capture board.
        variant === "light" && "text-[var(--textHeading)]",
        className
      )}
      {...props}
    >
      {keys.map((key, i) => {
        const label = typeof key === "string" ? key : key.label;
        const keyClassName = typeof key === "string" ? undefined : key.className;
        return (
          <React.Fragment key={i}>
            {i > 0 && variant === "dark" && (
              <span className="text-body-sm-medium text-[var(--textParagraph1)]">
                +
              </span>
            )}
            <Key variant={variant} className={keyClassName}>
              {label}
            </Key>
          </React.Fragment>
        );
      })}
    </kbd>
  );
}

export { Keycap, Key };
export type { KeyEntry, KeycapVariant };

import type { ComponentProps } from "react";

interface MetricValueProps extends ComponentProps<"span"> {
  /** The widest string this reading can show, e.g. "000" for a percentage.
   *  The per-reading strings live in lib/metric-reserve.ts. */
  reserve: string;
}

/**
 * A reading's slot. With fixed pill size on (fixed-pill-size.css) an invisible
 * copy of `reserve` sits under the live text in one grid cell, so the slot is
 * exactly as wide as the widest reading in this font, weight and tracking, and
 * the digits sit right-aligned in it so the unit after them never moves. Off,
 * the copy is display:none and this is a plain span.
 */
export function MetricValue({ reserve, children, ...props }: MetricValueProps) {
  return (
    <span {...props} data-metric-value>
      <span data-metric-reserve aria-hidden="true">{reserve}</span>
      <span data-metric-text>{children}</span>
    </span>
  );
}

interface MetricUnitProps extends Omit<ComponentProps<"span">, "children"> {
  children: string;
  /** The widest unit this slot can show when the unit changes at runtime:
   *  "MB/s" for a network rate, "GB" for RAM and VRAM that start out in "%".
   *  A static unit reserves itself and costs nothing extra. */
  reserve?: string;
}

/** The unit after a reading, in the same slot mechanism as MetricValue. */
export function MetricUnit({ children, reserve = children, ...props }: MetricUnitProps) {
  return (
    <span {...props} data-metric-unit>
      <span data-metric-reserve aria-hidden="true">{reserve}</span>
      <span data-metric-text>{children}</span>
    </span>
  );
}

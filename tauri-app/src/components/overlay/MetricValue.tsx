import type { ComponentProps } from "react";

// The slot is sized by CSS only when fixed pills are enabled. Keep the full
// reading in the title for unusually long values; never truncate the source.
export function MetricValue({ children, ...props }: ComponentProps<"span">) {
  const text = Array.isArray(children) ? children.join("") : String(children ?? "");
  return <span {...props} data-metric-value title={text}>{children}</span>;
}

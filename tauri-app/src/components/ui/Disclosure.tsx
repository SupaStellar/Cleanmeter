import * as React from "react";
import { cn } from "@/lib/utils";

/** Measured height releases to auto after opening, so nested content and focus rings aren't clipped. */
export function Disclosure({ open, children, className, id, variant = "accordion" }: {
  open: boolean; children: React.ReactNode; className?: string; id?: string; variant?: "accordion" | "panel";
}) {
  const [height, setHeight] = React.useState<number | "auto">(open ? "auto" : 0);
  const body = React.useRef<HTMLDivElement>(null);
  const first = React.useRef(true);
  React.useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    if (first.current) { first.current = false; return; }
    // Layout measurement must precede paint; auto height is restored after motion.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeight(open ? "auto" : 0);
      return;
    }
    const current = el.getBoundingClientRect().height;
    setHeight(current);
    const raf = requestAnimationFrame(() => {
      void el.offsetHeight;
      setHeight(open ? el.scrollHeight : 0);
    });
    const release = () => { if (open) setHeight("auto"); };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "height") release();
    };
    el.addEventListener("transitionend", onEnd);
    const timeout = setTimeout(release, variant === "panel" ? 450 : 300);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(timeout);
      el.removeEventListener("transitionend", onEnd);
    };
  }, [open, variant]);
  return (
    <div id={id} ref={body} data-open={open} data-motion={variant}
      aria-hidden={!open} inert={!open}
      className={cn("app-disclosure", height !== "auto" && "overflow-hidden")}
      style={{ height: height === "auto" ? undefined : height }}>
      <div data-open={open} className={cn(variant === "panel" ? "t-panel-slide app-panel-body" : "app-accordion-body", className)}>
        {children}
      </div>
    </div>
  );
}

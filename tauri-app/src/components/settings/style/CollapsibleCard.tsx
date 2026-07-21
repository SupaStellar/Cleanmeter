import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Gentle ease-out (Emil: enter/exit = ease-out; large panels want a soft
// curve, not an aggressive "shoot then settle"). Paired on chevron + panel.
const EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const DURATION = 250;

// White section card with uppercase title, optional right-side control
// (e.g. a switch for SHOW GRAPH), and a chevron that smoothly collapses the
// body. Matches the Figma Style-tab section pattern.
//
// The body height is animated with a CSS *transition* (not a keyframe): a
// transition never replays when a hidden tab is shown again (App keeps every
// tab mounted and toggles `display`), so returning to a tab keeps the section
// open with no re-run. Height animates 0 <-> measured px, then settles to
// `auto` while open so dynamic content is never clipped.
export function CollapsibleCard({
  title,
  defaultOpen = true,
  rightControl,
  children,
  bodyClassName,
}: {
  title: string;
  defaultOpen?: boolean;
  rightControl?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [height, setHeight] = React.useState<number | "auto">(
    defaultOpen ? "auto" : 0,
  );
  const contentId = React.useId();
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const firstRender = React.useRef(true);

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    // Honour defaultOpen instantly — never animate the initial paint.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setHeight(open ? "auto" : 0);
      return;
    }
    if (open) {
      // 0 -> measured, then release to auto once the slide finishes.
      setHeight(el.scrollHeight);
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") return;
        setHeight("auto");
        el.removeEventListener("transitionend", onEnd);
      };
      el.addEventListener("transitionend", onEnd);
      return () => el.removeEventListener("transitionend", onEnd);
    }
    // auto -> pin to current px, then next frame collapse to 0.
    setHeight(el.scrollHeight);
    const id = requestAnimationFrame(() => {
      void el.offsetHeight; // force reflow so the 0 target transitions
      setHeight(0);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <div className="flex w-full flex-col rounded-[12px] bg-[var(--bgSurfaceRaised)] p-5">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </span>
        {rightControl}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={contentId}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          className="flex items-center justify-center text-muted-foreground"
        >
          <ChevronDown
            className={cn(
              "size-5 transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            style={{ transitionDuration: `${DURATION}ms`, transitionTimingFunction: EASE }}
            strokeWidth={2}
          />
        </button>
      </div>
      <div
        ref={bodyRef}
        id={contentId}
        inert={!open}
        style={{
          height: height === "auto" ? undefined : height,
          transitionDuration: `${DURATION}ms`,
          transitionTimingFunction: EASE,
        }}
        className="overflow-hidden transition-[height] motion-reduce:transition-none"
      >
        <div className={cn("pt-5", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}

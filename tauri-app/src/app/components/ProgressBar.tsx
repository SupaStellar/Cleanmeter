import * as React from "react";
import { cn } from "@/lib/utils";

const DOT_COUNT = 11;
const MIDPOINT = Math.floor(DOT_COUNT / 2);
const STEPS = DOT_COUNT - 1; // 10 intervals → 0%, 10%, 20% … 100%

/** Snap a 0–100 value to the nearest dot position */
function snap(value: number) {
  const step = 100 / STEPS;
  return Math.round(value / step) * step;
}

type ProgressBarProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** Progress value from 0 to 100 — snaps to the nearest dot */
  value?: number;
  /** Called with the snapped value (0–100) on click/drag */
  onChange?: (value: number) => void;
  /** Accessible label for the slider */
  "aria-label"?: string;
};

function ProgressBar({ className, value = 0, onChange, "aria-label": ariaLabel, ...props }: ProgressBarProps) {
  const clamped = snap(Math.max(0, Math.min(100, value)));
  const step = 100 / STEPS;
  const trackRef = React.useRef<HTMLDivElement>(null);

  const resolveValue = React.useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const INSET = 10;
      const usable = rect.width - INSET * 2;
      const raw = ((clientX - rect.left - INSET) / usable) * 100;
      onChange?.(snap(Math.max(0, Math.min(100, raw))));
    },
    [onChange],
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resolveValue(e.clientX);
    },
    [resolveValue],
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      resolveValue(e.clientX);
    },
    [resolveValue],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      let next: number | null = null;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = snap(Math.min(100, clamped + step));
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = snap(Math.max(0, clamped - step));
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = 100;
          break;
      }
      if (next !== null) {
        e.preventDefault();
        onChange?.(next);
      }
    },
    [clamped, step, onChange],
  );

  return (
    <div
      className={cn("flex flex-col gap-[var(--spacingS)] w-full", className)}
      {...props}
    >
      {/* Bar */}
      <div
        ref={trackRef}
        className="relative h-3 w-full cursor-pointer touch-none"
        role="slider"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
      >
        {/* Track */}
        <div className="absolute inset-0 rounded-[var(--cornerRound)] bg-[var(--bgSurfaceSunkenSubtle)]" />

        {/* Filled portion — stretches from left edge to the thumb center */}
        <div
          className="absolute inset-y-0 left-0 rounded-[var(--cornerRound)] bg-[var(--bgBrand)]"
          style={{ width: `calc(10px + ${clamped}% * (100% - 20px) / 100%)` }}
        />

        {/* Dots & midpoint line — single layer on top of track + fill */}
        <TrackDots />

        {/* Thumb indicator — positioned within the 10px-inset dot range */}
        <div
          className="absolute top-1/2 z-20 size-[24px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `calc(10px + ${clamped}% * (100% - 20px) / 100%)` }}
        >
          <div className="size-full rounded-[var(--cornerRound)] border-[2px] border-[var(--bgBrand)] bg-[var(--bgSurfaceRaised)] drop-shadow-[0_8px_12px_rgba(0,0,0,0.06)]" />
        </div>
      </div>

      {/* Icons row */}
      <div className="flex items-center justify-between">
        <BrightnessEmptyIcon className="size-5 text-[var(--iconSubtle)]" />
        <BrightnessMediumIcon className="size-5 text-[var(--iconSubtle)]" />
        <BrightnessFullIcon className="size-5 text-[var(--iconSubtle)]" />
      </div>
    </div>
  );
}

function TrackDots() {
  return (
    <div className="absolute inset-x-[10px] top-1/2 z-10 flex -translate-y-1/2 items-center justify-between">
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <div
          key={i}
          className={cn(
            "shrink-0 rounded-[var(--cornerRound)] bg-[var(--bgSurfaceSunken)]",
            i === MIDPOINT ? "h-1.5 w-px" : "size-0.5"
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Brightness icons (from Figma DS)                                  */
/* ------------------------------------------------------------------ */

function BrightnessEmptyIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7.208 16.667H5a1.667 1.667 0 0 1-1.667-1.667v-2.208L1.73 11.167a1.74 1.74 0 0 1-.355-.553 1.67 1.67 0 0 1 0-1.228c.084-.201.201-.385.355-.553L3.333 7.208V5c0-.458.163-.851.49-1.177A1.605 1.605 0 0 1 5 3.333h2.208l1.625-1.604a1.74 1.74 0 0 1 .553-.354 1.67 1.67 0 0 1 1.228 0c.201.083.385.2.553.354l1.625 1.604H15c.458 0 .851.163 1.177.49.326.326.49.719.49 1.177v2.208l1.604 1.625c.153.167.271.351.354.553a1.67 1.67 0 0 1 0 1.228 1.74 1.74 0 0 1-.354.553l-1.604 1.625V15c0 .458-.163.851-.49 1.177-.326.326-.719.49-1.177.49h-2.208l-1.625 1.604a1.74 1.74 0 0 1-.553.354 1.67 1.67 0 0 1-1.228 0 1.74 1.74 0 0 1-.553-.354L7.208 16.667Zm.709-1.667L10 17.083 12.083 15H15v-2.917L17.083 10 15 7.917V5h-2.917L10 2.917 7.917 5H5v2.917L2.917 10 5 12.083V15h2.917Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BrightnessMediumIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7.208 16.667H5a1.667 1.667 0 0 1-1.667-1.667v-2.208L1.73 11.167a1.74 1.74 0 0 1-.355-.553 1.67 1.67 0 0 1 0-1.228c.084-.201.201-.385.355-.553L3.333 7.208V5c0-.458.163-.851.49-1.177A1.605 1.605 0 0 1 5 3.333h2.208l1.625-1.604a1.74 1.74 0 0 1 .553-.354 1.67 1.67 0 0 1 1.228 0c.201.083.385.2.553.354l1.625 1.604H15c.458 0 .851.163 1.177.49.326.326.49.719.49 1.177v2.208l1.604 1.625c.153.167.271.351.354.553a1.67 1.67 0 0 1 0 1.228 1.74 1.74 0 0 1-.354.553l-1.604 1.625V15c0 .458-.163.851-.49 1.177-.326.326-.719.49-1.177.49h-2.208l-1.625 1.604a1.74 1.74 0 0 1-.553.354 1.67 1.67 0 0 1-1.228 0 1.74 1.74 0 0 1-.553-.354L7.208 16.667Zm.709-1.667L10 17.083 12.083 15H15v-2.917L17.083 10 15 7.917V5h-2.917L10 2.917 7.917 5H5v2.917L2.917 10 5 12.083V15h2.917ZM10 14.167a4.167 4.167 0 0 0 2.948-1.22A4.167 4.167 0 0 0 14.167 10a4.167 4.167 0 0 0-1.22-2.948A4.167 4.167 0 0 0 10 5.833V14.167Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BrightnessFullIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M7.208 16.667H5a1.667 1.667 0 0 1-1.667-1.667v-2.208L1.73 11.167a1.74 1.74 0 0 1-.355-.553 1.67 1.67 0 0 1 0-1.228c.084-.201.201-.385.355-.553L3.333 7.208V5c0-.458.163-.851.49-1.177A1.605 1.605 0 0 1 5 3.333h2.208l1.625-1.604a1.74 1.74 0 0 1 .553-.354 1.67 1.67 0 0 1 1.228 0c.201.083.385.2.553.354l1.625 1.604H15c.458 0 .851.163 1.177.49.326.326.49.719.49 1.177v2.208l1.604 1.625c.153.167.271.351.354.553a1.67 1.67 0 0 1 0 1.228 1.74 1.74 0 0 1-.354.553l-1.604 1.625V15c0 .458-.163.851-.49 1.177-.326.326-.719.49-1.177.49h-2.208l-1.625 1.604a1.74 1.74 0 0 1-.553.354 1.67 1.67 0 0 1-1.228 0 1.74 1.74 0 0 1-.553-.354L7.208 16.667ZM10 14.167a4.167 4.167 0 0 0 2.948-1.22A4.167 4.167 0 0 0 14.167 10a4.167 4.167 0 0 0-1.22-2.948A4.167 4.167 0 0 0 10 5.833a4.167 4.167 0 0 0-2.948 1.22A4.167 4.167 0 0 0 5.833 10c0 1.153.406 2.135 1.22 2.948A4.167 4.167 0 0 0 10 14.167Zm-2.083.833L10 17.083 12.083 15H15v-2.917L17.083 10 15 7.917V5h-2.917L10 2.917 7.917 5H5v2.917L2.917 10 5 12.083V15h2.917Z"
        fill="currentColor"
      />
    </svg>
  );
}

export { ProgressBar };

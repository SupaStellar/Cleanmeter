import type { OverlaySettings } from "./types";

// Figma 3041:6502: "Shift by" 1–4px and "Frequency" 1, 2, 3 or 5 minutes,
// recommended 3px every 2 minutes. Frequency is stored in seconds.
export const PIXEL_SHIFT_DISTANCES = [1, 2, 3, 4] as const;
export const PIXEL_SHIFT_INTERVALS = [60, 120, 180, 300] as const;
export const PIXEL_SHIFT_DEFAULT_DISTANCE = 3;
export const PIXEL_SHIFT_DEFAULT_INTERVAL = 120;

// Snap a saved value onto the nearest offered option, so a hand-edited or
// older settings file still lands on something the dropdown can show.
function nearestOption(value: number, options: readonly number[], fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  );
}

export function pixelShiftOptions(settings: Pick<OverlaySettings, "pixelShiftDistance" | "pixelShiftInterval">) {
  return {
    distance: nearestOption(settings.pixelShiftDistance, PIXEL_SHIFT_DISTANCES, PIXEL_SHIFT_DEFAULT_DISTANCE),
    interval: nearestOption(settings.pixelShiftInterval, PIXEL_SHIFT_INTERVALS, PIXEL_SHIFT_DEFAULT_INTERVAL),
  };
}

// The offset (logical px) after `tick` intervals. Walks a snake over every
// point within +/-distance on both axes, out and back, starting from the
// centre: each tick moves exactly 1px on one axis, so every interval moves
// the overlay and it never strays further than the chosen distance. Output is
// physical pixels; the distance is logical, like the rest of the UI.
export function pixelShiftPosition(tick: number, distance: number, dpr: number) {
  const side = 2 * distance + 1;
  const points = side * side;
  const period = 2 * (points - 1);
  const centre = 2 * distance * (distance + 1);
  const i = (centre + tick) % period;
  const index = i < points ? i : period - i;
  const row = Math.floor(index / side);
  const col = index % side;
  const x = row % 2 === 0 ? col - distance : distance - col;
  const y = row - distance;
  return { x: Math.round(x * dpr), y: Math.round(y * dpr) };
}

// Add an offset to one axis of the overlay's position, keeping it within
// [min, max]. An overlay parked against a screen edge would otherwise lose
// every step that points off-screen, so the path is reflected off the edge
// instead: steps that were 1px apart stay 1px apart.
export function shiftAxis(base: number, offset: number, min: number, max: number) {
  const shifted = base + offset;
  const value = shifted < min ? 2 * min - shifted : shifted > max ? 2 * max - shifted : shifted;
  return Math.min(Math.max(value, min), max);
}

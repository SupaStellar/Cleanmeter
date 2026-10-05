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

// Keep the same path as the old 6px/3s option. Larger distances take more
// steps, rather than making each movement an abrupt jump. Output is physical
// pixels; the user's distance is in logical pixels, like the rest of the UI.
export function pixelShiftPosition(tick: number, distance: number, dpr: number) {
  const phase = tick * Math.min(0.1, 0.6 / distance);
  return {
    x: Math.round(distance * Math.sin(phase) * dpr),
    y: Math.round(distance * Math.sin(phase * Math.SQRT2) * dpr),
  };
}

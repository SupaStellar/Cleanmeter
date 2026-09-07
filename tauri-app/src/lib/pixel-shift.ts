import type { OverlaySettings } from "./types";

export function boundedInteger(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

export function pixelShiftOptions(settings: Pick<OverlaySettings, "pixelShiftDistance" | "pixelShiftInterval">) {
  return {
    distance: boundedInteger(settings.pixelShiftDistance, 1, 20, 6),
    interval: boundedInteger(settings.pixelShiftInterval, 1, 60, 3),
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

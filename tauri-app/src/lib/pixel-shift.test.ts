import { describe, expect, it } from "vitest";
import { pixelShiftOptions, pixelShiftPosition } from "./pixel-shift";

describe("pixel shift", () => {
  it("uses the shipped defaults for missing or invalid saved values", () => {
    expect(pixelShiftOptions({ pixelShiftDistance: undefined!, pixelShiftInterval: NaN })).toEqual({ distance: 6, interval: 3 });
    expect(pixelShiftOptions({ pixelShiftDistance: -50, pixelShiftInterval: 10000 })).toEqual({ distance: 1, interval: 60 });
  });
  it("stays bounded and takes small steps across distances and DPI scales", () => {
    for (const distance of [1, 6, 20]) for (const dpr of [1, 1.5, 2]) {
      let previous = { x: 0, y: 0 };
      for (let tick = 1; tick < 1000; tick++) {
        const next = pixelShiftPosition(tick, distance, dpr);
        expect(Math.abs(next.x)).toBeLessThanOrEqual(Math.ceil(distance * dpr));
        expect(Math.abs(next.y)).toBeLessThanOrEqual(Math.ceil(distance * dpr));
        expect(Math.abs(next.x - previous.x)).toBeLessThanOrEqual(Math.ceil(dpr));
        expect(Math.abs(next.y - previous.y)).toBeLessThanOrEqual(Math.ceil(dpr));
        previous = next;
      }
    }
  });
});

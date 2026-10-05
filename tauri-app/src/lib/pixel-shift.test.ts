import { describe, expect, it } from "vitest";
import { pixelShiftOptions, pixelShiftPosition } from "./pixel-shift";

describe("pixel shift", () => {
  it("uses the recommended 3px / 2min for missing or invalid saved values", () => {
    expect(pixelShiftOptions({ pixelShiftDistance: undefined!, pixelShiftInterval: NaN })).toEqual({ distance: 3, interval: 120 });
  });

  it("snaps saved values onto the offered options", () => {
    expect(pixelShiftOptions({ pixelShiftDistance: -50, pixelShiftInterval: 3 })).toEqual({ distance: 1, interval: 60 });
    expect(pixelShiftOptions({ pixelShiftDistance: 20, pixelShiftInterval: 10000 })).toEqual({ distance: 4, interval: 300 });
    expect(pixelShiftOptions({ pixelShiftDistance: 2, pixelShiftInterval: 180 })).toEqual({ distance: 2, interval: 180 });
  });

  it("stays bounded and takes small steps across distances and DPI scales", () => {
    for (const distance of [1, 2, 3, 4]) for (const dpr of [1, 1.5, 2]) {
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

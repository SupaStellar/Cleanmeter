import { describe, expect, it } from "vitest";
import {
  PIXEL_SHIFT_DISTANCES,
  pixelShiftOptions,
  pixelShiftPosition,
  shiftAxis,
} from "./pixel-shift";

describe("pixel shift", () => {
  it("uses the recommended 3px / 2min for missing or invalid saved values", () => {
    expect(pixelShiftOptions({ pixelShiftDistance: undefined!, pixelShiftInterval: NaN })).toEqual({ distance: 3, interval: 120 });
  });

  it("snaps saved values onto the offered options", () => {
    expect(pixelShiftOptions({ pixelShiftDistance: -50, pixelShiftInterval: 3 })).toEqual({ distance: 1, interval: 60 });
    expect(pixelShiftOptions({ pixelShiftDistance: 20, pixelShiftInterval: 10000 })).toEqual({ distance: 4, interval: 300 });
    expect(pixelShiftOptions({ pixelShiftDistance: 2, pixelShiftInterval: 180 })).toEqual({ distance: 2, interval: 180 });
  });

  for (const distance of PIXEL_SHIFT_DISTANCES) {
    it(`moves exactly 1px every tick and stays within ${distance}px`, () => {
      expect(pixelShiftPosition(0, distance, 1)).toEqual({ x: 0, y: 0 });
      let previous = { x: 0, y: 0 };
      for (let tick = 1; tick < 1000; tick++) {
        const next = pixelShiftPosition(tick, distance, 1);
        expect(Math.abs(next.x)).toBeLessThanOrEqual(distance);
        expect(Math.abs(next.y)).toBeLessThanOrEqual(distance);
        expect(Math.abs(next.x - previous.x) + Math.abs(next.y - previous.y)).toBe(1);
        previous = next;
      }
    });

    it(`visits every point within ${distance}px`, () => {
      const side = 2 * distance + 1;
      const seen = new Set<string>();
      for (let tick = 0; tick < 2 * side * side; tick++) {
        const { x, y } = pixelShiftPosition(tick, distance, 1);
        seen.add(`${x},${y}`);
      }
      expect(seen.size).toBe(side * side);
    });
  }

  it("still moves every tick at fractional DPI scales", () => {
    for (const distance of PIXEL_SHIFT_DISTANCES) for (const dpr of [1.25, 1.5, 1.75, 2]) {
      let previous = pixelShiftPosition(0, distance, dpr);
      for (let tick = 1; tick < 500; tick++) {
        const next = pixelShiftPosition(tick, distance, dpr);
        expect(next).not.toEqual(previous);
        expect(Math.abs(next.x)).toBeLessThanOrEqual(Math.round(distance * dpr));
        expect(Math.abs(next.y)).toBeLessThanOrEqual(Math.round(distance * dpr));
        previous = next;
      }
    }
  });

  it("reflects steps that would leave the screen back inward", () => {
    expect(shiftAxis(100, -3, 0, 1000)).toBe(97);
    expect(shiftAxis(0, -3, 0, 1000)).toBe(3);
    expect(shiftAxis(1, -3, 0, 1000)).toBe(2);
    expect(shiftAxis(1000, 2, 0, 1000)).toBe(998);
  });

  it("keeps every step 1px wherever the overlay sits near an edge", () => {
    for (const distance of PIXEL_SHIFT_DISTANCES) for (let base = 0; base <= distance; base++) {
      for (const [min, max, at] of [[0, 1000, base], [0, 1000, 1000 - base]]) {
        let previous = shiftAxis(at, pixelShiftPosition(0, distance, 1).x, min, max);
        for (let tick = 1; tick < 500; tick++) {
          const next = shiftAxis(at, pixelShiftPosition(tick, distance, 1).x, min, max);
          expect(Math.abs(next - previous)).toBeLessThanOrEqual(1);
          previous = next;
        }
      }
    }
  });
});

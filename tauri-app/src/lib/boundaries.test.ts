import { describe, it, expect } from "vitest";
import type { Boundaries } from "./types";
import {
  applyBoundary,
  boundaryRange,
  isBoundaryInRange,
  type BoundaryField,
} from "./boundaries";

const MAX = 100;
const DEFAULTS: Boundaries = { low: 60, medium: 80, high: 90 };

const nearestLegal = (
  field: BoundaryField,
  v: number,
  b: Boundaries,
  max = MAX,
) => {
  const { min, max: hi } = boundaryRange(field, b, max);
  return Math.max(min, Math.min(hi, v));
};

/**
 * The old control: a number input fully controlled by the store, whose onChange
 * clamped every keystroke and wrote the clamped number straight back. The
 * field's text was therefore replaced after each key, so the next digit
 * appended to a number the user never typed.
 */
function typeClampingEveryKeystroke(
  field: BoundaryField,
  keys: string,
  start: Boundaries,
  max = MAX,
): Boundaries {
  let b = start;
  let text = "";
  for (const key of keys) {
    text += key;
    b = { ...b, [field]: nearestLegal(field, parseInt(text || "0", 10), b, max) };
    text = String(b[field]); // controlled input snaps the text back
  }
  return b;
}

/**
 * The control as it now behaves: the field keeps the user's own text, only a
 * value needing no other field to move is stored while typing, and the commit
 * keeps what was typed and moves the neighbours instead.
 */
function typeKeepingTheDraft(
  field: BoundaryField,
  keys: string,
  start: Boundaries,
  max = MAX,
): Boundaries {
  let b = start;
  let text = "";
  for (const key of keys) {
    text += key;
    const typed = parseInt(text, 10);
    if (Number.isFinite(typed) && isBoundaryInRange(field, typed, b, max)) {
      b = { ...b, [field]: typed };
    }
  }
  const typed = parseInt(text, 10); // commit
  return Number.isFinite(typed) ? applyBoundary(field, typed, b, max) : b;
}

const ordered = (b: Boundaries, max = MAX) =>
  0 <= b.low && b.low < b.medium && b.medium < b.high && b.high <= max;

describe("boundaryRange", () => {
  it("is the window in which no other bound has to move", () => {
    expect(boundaryRange("low", DEFAULTS, MAX)).toEqual({ min: 0, max: 79 });
    expect(boundaryRange("medium", DEFAULTS, MAX)).toEqual({ min: 61, max: 89 });
    expect(boundaryRange("high", DEFAULTS, MAX)).toEqual({ min: 81, max: 100 });
  });

  it("treats an unset high as the top of the scale", () => {
    const b: Boundaries = { low: 60, medium: 80, high: 0 };
    expect(boundaryRange("medium", b, MAX)).toEqual({ min: 61, max: 99 });
  });
});

describe("clamping every keystroke (the reported bug)", () => {
  // Reported 2026-08-19 against the v2.2.15 draft: GPU Usage ended up reading
  // Low 0-20 / Medium 20-21 / High 21-81, and the fields refused typing,
  // backspacing and editing. settings.json held exactly that triple.
  it("turns three ordinary edits into 20 / 21 / 81", () => {
    let b = DEFAULTS;
    b = typeClampingEveryKeystroke("low", "20", b);
    b = typeClampingEveryKeystroke("high", "8", b);
    b = typeClampingEveryKeystroke("medium", "2", b);
    expect(b).toEqual({ low: 20, medium: 21, high: 81 });
  });

  it("destroys a multi-digit value because the first digit is clamped first", () => {
    // Typing 30 into Medium: "3" is clamped up to 61, the field becomes "61",
    // and the trailing 0 turns it into 610, which clamps to the top of range.
    expect(typeClampingEveryKeystroke("medium", "30", DEFAULTS)).toEqual({
      low: 60,
      medium: 89,
      high: 90,
    });
  });

  it("cannot clear a field, because an empty input reads as zero", () => {
    // Backspacing "80" to "" parses as 0 and is clamped straight back up to the
    // segment minimum, so the field never appears to empty.
    expect(nearestLegal("medium", 0, DEFAULTS)).toBe(61);
  });
});

describe("applyBoundary", () => {
  it("keeps what was typed and pushes the neighbour up", () => {
    // Reported 2026-08-19: typing 40 into Low became 39 whenever Medium was
    // already 40. Medium yields instead.
    expect(applyBoundary("low", 40, { low: 20, medium: 40, high: 90 }, MAX)).toEqual({
      low: 40,
      medium: 41,
      high: 90,
    });
  });

  it("leaves the neighbours alone when there is already room", () => {
    expect(applyBoundary("low", 40, { low: 20, medium: 80, high: 90 }, MAX)).toEqual({
      low: 40,
      medium: 80,
      high: 90,
    });
  });

  it("pushes a threshold downward too", () => {
    expect(applyBoundary("medium", 30, DEFAULTS, MAX)).toEqual({
      low: 29,
      medium: 30,
      high: 90,
    });
  });

  it("carries a push through both bounds when one is not enough", () => {
    expect(applyBoundary("low", 100, { low: 20, medium: 80, high: 90 }, MAX)).toEqual({
      low: 98,
      medium: 99,
      high: 100,
    });
  });

  // getBoundaryColor reads low and medium and never high, so High is drawn but
  // never compared against. It must not be able to drag the two values the
  // colours depend on down with it.
  it("clamps High rather than letting it rewrite the thresholds", () => {
    expect(applyBoundary("high", 50, { low: 20, medium: 80, high: 90 }, MAX)).toEqual({
      low: 20,
      medium: 80,
      high: 81,
    });
    expect(applyBoundary("high", 1, { low: 20, medium: 80, high: 90 }, MAX)).toEqual({
      low: 20,
      medium: 80,
      high: 81,
    });
  });

  it("still lets High move freely above medium", () => {
    expect(applyBoundary("high", 95, { low: 20, medium: 80, high: 90 }, MAX)).toEqual({
      low: 20,
      medium: 80,
      high: 95,
    });
  });

  it("repairs a degenerate stored set rather than emitting one", () => {
    // Only reachable from corrupted data: the medium branch caps medium at
    // max - 1, so nothing this code writes can get here.
    expect(applyBoundary("high", 50, { low: 98, medium: 100, high: 100 }, MAX)).toEqual({
      low: 98,
      medium: 99,
      high: 100,
    });
  });

  it("raises high to stay above a medium pushed past it", () => {
    expect(applyBoundary("medium", 95, DEFAULTS, MAX)).toEqual({
      low: 60,
      medium: 95,
      high: 96,
    });
  });

  it("honours a non-percent scale", () => {
    // Temperatures run to 120 °C.
    expect(applyBoundary("high", 130, { low: 60, medium: 80, high: 90 }, 120)).toEqual({
      low: 60,
      medium: 80,
      high: 120,
    });
  });

  it("leaves the bound alone when handed a value that is not a number", () => {
    expect(applyBoundary("medium", NaN, DEFAULTS, MAX)).toEqual(DEFAULTS);
  });

  it("always returns an ordered set, whatever it is handed", () => {
    const wild = [-50, -1, 0, 1, 2, 39, 40, 41, 99, 100, 101, 5000, NaN];
    const starts: Boundaries[] = [
      { low: 60, medium: 80, high: 90 },
      { low: 0, medium: 1, high: 2 },
      { low: 20, medium: 40, high: 90 },
      { low: 97, medium: 98, high: 99 },
      { low: 60, medium: 80, high: 0 },
    ];
    for (const field of ["low", "medium", "high"] as BoundaryField[]) {
      for (const start of starts) {
        for (const v of wild) {
          const out = applyBoundary(field, v, start, MAX);
          expect(ordered(out), `${field}=${v} from ${JSON.stringify(start)} gave ${JSON.stringify(out)}`).toBe(true);
        }
      }
    }
  });
});

describe("keeping the draft while typing (the fix)", () => {
  it("lands the values the user actually typed", () => {
    let b = DEFAULTS;
    b = typeKeepingTheDraft("low", "20", b);
    b = typeKeepingTheDraft("high", "85", b);
    b = typeKeepingTheDraft("medium", "40", b);
    expect(b).toEqual({ low: 20, medium: 40, high: 85 });
  });

  it("lowers the two thresholds in either order", () => {
    // The old control could only do this left to right; Medium below Low used
    // to clamp instead of pushing Low down.
    let left = DEFAULTS;
    left = typeKeepingTheDraft("low", "20", left);
    left = typeKeepingTheDraft("medium", "30", left);
    expect(left).toEqual({ low: 20, medium: 30, high: 90 });

    let right = DEFAULTS;
    right = typeKeepingTheDraft("medium", "30", right);
    right = typeKeepingTheDraft("low", "20", right);
    expect(right).toEqual({ low: 20, medium: 30, high: 90 });
  });

  it("needs High lowered last, since it will not drag the thresholds down", () => {
    let b = DEFAULTS;
    b = typeKeepingTheDraft("low", "20", b);
    b = typeKeepingTheDraft("medium", "30", b);
    b = typeKeepingTheDraft("high", "40", b);
    expect(b).toEqual({ low: 20, medium: 30, high: 40 });

    // High first has nowhere to go while Medium is still 80: it settles just
    // above it rather than pulling Medium and Low down.
    expect(typeKeepingTheDraft("high", "40", DEFAULTS)).toEqual({
      low: 60,
      medium: 80,
      high: 81,
    });
  });

  it("leaves the stored values alone when the field is left empty", () => {
    expect(typeKeepingTheDraft("medium", "", DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe("isBoundaryInRange", () => {
  it("rejects the half-typed digit and accepts the finished number", () => {
    expect(isBoundaryInRange("medium", 3, DEFAULTS, MAX)).toBe(false);
    expect(isBoundaryInRange("medium", 30, { ...DEFAULTS, low: 20 }, MAX)).toBe(true);
  });
});

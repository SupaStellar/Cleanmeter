import type { Boundaries } from "./types";

/**
 * Threshold editing for the three-segment range control.
 *
 * The segments are contiguous — Low is 0→low, Medium is low→medium, High is
 * medium→high — so the three upper bounds have to stay ordered. Two rules keep
 * that true without the control fighting whoever is typing:
 *
 *   - while a field is focused, only a value that needs nothing else to move is
 *     stored (`isBoundaryInRange`), so a half-typed number is never written and
 *     never rewrites the field's text;
 *   - on commit, an edited threshold keeps the value it was given and whatever
 *     is in the way moves by the minimum needed to stay ordered
 *     (`applyBoundary`).
 *
 * Which bound wins follows from what the bounds mean. `getBoundaryColor` reads
 * only `low` and `medium`; `high` is the top of the scale, drawn but never
 * compared against. So the two thresholds outrank it — and each other, in the
 * direction being edited — while `high` clamps instead of pushing, since a
 * display bound has no business rewriting the values the colours depend on.
 */

export type BoundaryField = keyof Boundaries;

export interface BoundaryLimits {
  min: number;
  max: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** An unset `high` behaves as the top of the scale rather than as 0. */
const topOf = (boundaries: Boundaries, max: number) => boundaries.high || max;

/**
 * Range a segment's upper bound can take with the other two left alone.
 * Narrower than the scale: it is the "no neighbour has to move" window.
 */
export function boundaryRange(
  field: BoundaryField,
  boundaries: Boundaries,
  max: number,
): BoundaryLimits {
  switch (field) {
    case "low":
      return { min: 0, max: boundaries.medium - 1 };
    case "medium":
      return { min: boundaries.low + 1, max: topOf(boundaries, max) - 1 };
    case "high":
      return { min: boundaries.medium + 1, max };
  }
}

/**
 * Whether a value can be stored as typed with nothing else moving. False means
 * "not yet" — the caller is mid-edit and should keep the user's text.
 */
export function isBoundaryInRange(
  field: BoundaryField,
  value: number,
  boundaries: Boundaries,
  max: number,
): boolean {
  const limits = boundaryRange(field, boundaries, max);
  return value >= limits.min && value <= limits.max;
}

/**
 * Commit an edited bound, keeping 0 ≤ low < medium < high ≤ max.
 *
 * `low` and `medium` are the real thresholds, so an edit to either keeps the
 * number it was given and moves whatever is in the way — including `high`,
 * which is only the top of the scale. `high` does not get that power in
 * return: it clamps to sit just above `medium` rather than dragging the two
 * thresholds down with it, because a display bound must not be able to rewrite
 * the values the gauge colours actually depend on.
 */
export function applyBoundary(
  field: BoundaryField,
  value: number,
  boundaries: Boundaries,
  max: number,
): Boundaries {
  let { low, medium } = boundaries;
  let high = topOf(boundaries, max);

  // NaN would survive Math.min/Math.max and be returned as a bound, so a
  // non-finite value means "leave this one where it is". The caller guards
  // before committing; this keeps the ordering guarantee true for every caller.
  const v = Number.isFinite(value) ? value : { low, medium, high }[field];

  switch (field) {
    // Two bounds have to fit above Low, hence max - 2.
    case "low":
      low = clamp(v, 0, max - 2);
      if (medium <= low) medium = low + 1;
      if (high <= medium) high = medium + 1;
      break;
    case "medium":
      medium = clamp(v, 1, max - 1);
      if (low >= medium) low = medium - 1;
      if (high <= medium) high = medium + 1;
      break;
    case "high":
      // The floor keeps High above Medium without moving it. Math.min only
      // matters if stored data is already degenerate (medium at the top of the
      // scale); the two lines below then repair it. In normal use, where the
      // medium branch caps medium at max - 1, neither can fire.
      high = clamp(v, Math.min(medium + 1, max), max);
      if (medium >= high) medium = high - 1;
      if (low >= medium) low = medium - 1;
      break;
  }

  return { low, medium, high };
}

import { describe, it, expect } from "vitest";
import { formatFrametime, gigabyteReserve } from "./metric-reserve";

describe("gigabyteReserve", () => {
  it("reserves as many integer digits as the total has", () => {
    expect(gigabyteReserve(15.9)).toBe("00.0");
    expect(gigabyteReserve(31.8)).toBe("00.0");
    expect(gigabyteReserve(127.5)).toBe("000.0");
  });

  it("never drops under the three digits of the % fallback", () => {
    // A 4 GB card shows "3.9" in GB, but "100" while the GB reading is still
    // missing, and "100" is wider than "0.0".
    expect(gigabyteReserve(4)).toBe("000");
    expect(gigabyteReserve(7.9)).toBe("000");
  });

  it("counts the digits of the total as it would be displayed", () => {
    // A 9.96 GB total displays as "10.0", and a used reading that high must
    // still fit the slot.
    expect(gigabyteReserve(9.96)).toBe("00.0");
    expect(gigabyteReserve(99.97)).toBe("000.0");
  });

  it("falls back to two digits while the total is unknown", () => {
    expect(gigabyteReserve(0)).toBe("00.0");
    expect(gigabyteReserve(NaN)).toBe("00.0");
    expect(gigabyteReserve(Infinity)).toBe("00.0");
  });
});

describe("formatFrametime", () => {
  it("shows one decimal with the unit", () => {
    expect(formatFrametime(6.94)).toBe("6.9 ms");
    expect(formatFrametime(16.67)).toBe("16.7 ms");
    expect(formatFrametime(0)).toBe("0.0 ms");
  });

  it("saturates at 999.9 ms so the reading never outgrows its reserve", () => {
    // The sidecar reports the raw present-to-present interval: the first
    // frame after an idle gap or a loading screen carries the whole gap.
    expect(formatFrametime(1000)).toBe("999.9 ms");
    expect(formatFrametime(3000.4)).toBe("999.9 ms");
    expect(formatFrametime(999.96)).toBe("999.9 ms");
  });
});

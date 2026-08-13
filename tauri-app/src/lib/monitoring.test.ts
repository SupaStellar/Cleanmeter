import { describe, expect, it } from "vitest";
import {
  CRASH_LOOP_EXITS,
  STARTUP_GRACE_MS,
  monitoringVerdict,
} from "./monitoring";
import type { SidecarStatus } from "./types";

const healthy: SidecarStatus = { exits: 0, spawnError: null };

describe("monitoringVerdict", () => {
  it("is ok once a reading has arrived", () => {
    expect(
      monitoringVerdict({ hasSensorData: true, sidecar: healthy, graceExpired: false }),
    ).toBe("ok");
  });

  it("stays ok after a reading even if the sidecar has crashed since", () => {
    expect(
      monitoringVerdict({
        hasSensorData: true,
        sidecar: { exits: 5, spawnError: "boom" },
        graceExpired: true,
      }),
    ).toBe("ok");
  });

  // The bug this exists to prevent. A launch with nothing wrong with it used to
  // be called "not connected" purely because 8 seconds had passed, which reads
  // to the user as a broken app. Across 114 measured launches the sidecar's
  // hardware enumeration alone took a median of 1.55s and up to 13.7s, and 36
  // of 113 launches had not produced a first reading by the old 8s deadline.
  it("reports a normal slow start as starting, not as a failure", () => {
    expect(
      monitoringVerdict({ hasSensorData: false, sidecar: healthy, graceExpired: false }),
    ).toBe("starting");
  });

  it("tolerates a single sidecar exit, which a crash that recovers produces", () => {
    expect(
      monitoringVerdict({
        hasSensorData: false,
        sidecar: { exits: 1, spawnError: null },
        graceExpired: false,
      }),
    ).toBe("starting");
  });

  // Pins the threshold itself. Asserting only `CRASH_LOOP_EXITS -> failed` and
  // `1 -> starting` stays green for any value above 1, so the rule could drift
  // to 10 without a failure.
  it("draws the line at exactly two exits", () => {
    expect(CRASH_LOOP_EXITS).toBe(2);
    expect(
      monitoringVerdict({
        hasSensorData: false,
        sidecar: { exits: 2, spawnError: null },
        graceExpired: false,
      }),
    ).toBe("failed");
  });

  it("fails immediately when the sidecar could not be started at all", () => {
    expect(
      monitoringVerdict({
        hasSensorData: false,
        sidecar: { exits: 0, spawnError: "program not found" },
        graceExpired: false,
      }),
    ).toBe("failed");
  });

  it("fails once the sidecar is exiting repeatedly", () => {
    expect(
      monitoringVerdict({
        hasSensorData: false,
        sidecar: { exits: CRASH_LOOP_EXITS, spawnError: null },
        graceExpired: false,
      }),
    ).toBe("failed");
  });

  it("still reports a sidecar that runs but never produces a reading", () => {
    expect(
      monitoringVerdict({ hasSensorData: false, sidecar: healthy, graceExpired: true }),
    ).toBe("failed");
  });
});

describe("STARTUP_GRACE_MS", () => {
  // Guards the measurement rather than the code: the slowest of 114 logged
  // launches took 19.67s from sidecar start to the app connecting, and a reading
  // follows shortly after. A grace period near that number would put the false
  // warning straight back.
  it("leaves real headroom over the slowest launch measured", () => {
    const slowestObservedMs = 19_670;
    expect(STARTUP_GRACE_MS).toBeGreaterThan(slowestObservedMs * 2);
  });
});

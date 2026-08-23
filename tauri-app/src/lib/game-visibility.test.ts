import { describe, expect, it } from "vitest";
import { isGamePresenting } from "./game-visibility";
import { SensorType, type HardwareMonitorData, type Sensor } from "./types";

function snapshot(...sensors: Sensor[]): HardwareMonitorData {
  return { hardwares: [], sensors, lastPollTime: 0 };
}

function reading(identifier: string, value: number): Sensor {
  return {
    name: "Presented Frames",
    identifier,
    hardwareIdentifier: "/presentmon",
    sensorType: SensorType.Load,
    value,
  };
}

describe("isGamePresenting", () => {
  it("detects positive PresentMon presented frames", () => {
    expect(isGamePresenting(snapshot(reading("/presentmon/presented", 144)))).toBe(true);
  });

  it.each([0, -1, Number.NaN])("treats a non-playing value of %s as inactive", (value) => {
    expect(isGamePresenting(snapshot(reading("/presentmon/presented", value)))).toBe(false);
  });

  it("ignores unrelated positive load sensors", () => {
    expect(isGamePresenting(snapshot(reading("/cpu/0/load/0", 80)))).toBe(false);
  });

  it("treats a missing snapshot as inactive", () => {
    expect(isGamePresenting(null)).toBe(false);
  });
});

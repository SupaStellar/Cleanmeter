import { describe, expect, it } from "vitest";
import { SensorType, type Sensor } from "./types";
import {
  selectSensorReadings,
  sensorReadingIds,
  sensorReadingPatch,
} from "./sensor-readings";

function reading(identifier: string, hardwareIdentifier = "/gpu-nvidia/0"): Sensor {
  return {
    name: identifier.endsWith("/1") ? "GPU Hot Spot" : "GPU Core",
    identifier,
    hardwareIdentifier,
    sensorType: SensorType.Temperature,
    value: 60,
  };
}

describe("sensorReadingIds", () => {
  it("keeps the primary reading first and removes blanks and duplicates", () => {
    expect(
      sensorReadingIds({
        customReadingId: "/temperature/0",
        additionalReadingIds: ["", "/temperature/1", "/temperature/0"],
      }),
    ).toEqual(["/temperature/0", "/temperature/1"]);
  });

  it("accepts a settings object from an older build with no additional IDs", () => {
    expect(
      sensorReadingIds({
        customReadingId: "/temperature/0",
        additionalReadingIds: undefined as unknown as string[],
      }),
    ).toEqual(["/temperature/0"]);
  });
});

describe("sensorReadingPatch", () => {
  it("promotes the first selected reading and stores the rest as supplemental", () => {
    expect(sensorReadingPatch(["/temperature/1", "/temperature/0"])).toEqual({
      customReadingId: "/temperature/1",
      additionalReadingIds: ["/temperature/0"],
    });
  });
});

describe("selectSensorReadings", () => {
  const core = reading("/gpu-nvidia/0/temperature/0");
  const hotSpot = reading("/gpu-nvidia/0/temperature/1");
  const otherGpu = reading("/gpu-intel/0/temperature/0", "/gpu-intel/0");

  it("resolves multiple readings in configured order", () => {
    expect(
      selectSensorReadings([hotSpot, core], {
        customReadingId: core.identifier,
        additionalReadingIds: [hotSpot.identifier],
      }),
    ).toEqual({ primary: core, additional: [hotSpot] });
  });

  it("omits a temporarily unavailable reading without discarding other values", () => {
    expect(
      selectSensorReadings([core], {
        customReadingId: core.identifier,
        additionalReadingIds: [hotSpot.identifier],
      }),
    ).toEqual({ primary: core, additional: [] });
  });

  it("promotes a live supplemental reading while the configured primary is unavailable", () => {
    expect(
      selectSensorReadings([hotSpot], {
        customReadingId: core.identifier,
        additionalReadingIds: [hotSpot.identifier],
      }),
    ).toEqual({ primary: hotSpot, additional: [] });
  });

  it("can constrain every reading to the selected source", () => {
    expect(
      selectSensorReadings(
        [core, otherGpu],
        {
          customReadingId: core.identifier,
          additionalReadingIds: [otherGpu.identifier],
        },
        (sensor) => sensor.hardwareIdentifier === "/gpu-nvidia/0",
      ),
    ).toEqual({ primary: core, additional: [] });
  });
});

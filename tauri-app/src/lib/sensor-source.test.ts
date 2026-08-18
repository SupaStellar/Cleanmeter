import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./types";
import {
  customReadingNeedsRefresh,
  isDownloadSensorName,
  isUploadSensorName,
} from "./sensor-source";
import type { Sensor } from "./types";
import { SensorType } from "./types";

describe("DEFAULT_SETTINGS.sensorSource", () => {
  it("defaults to auto so HWiNFO is used when shared memory is healthy", () => {
    expect(DEFAULT_SETTINGS.sensorSource).toBe("auto");
  });
});

const sensor = (identifier: string): Sensor => ({
  name: identifier,
  identifier,
  hardwareIdentifier: "/hw",
  sensorType: SensorType.Load,
  value: 1,
});

describe("customReadingNeedsRefresh", () => {
  it("refills empty and stale LHM/HWiNFO ids, but never PresentMon", () => {
    const live = [sensor("/hwinfo/e0000200/0/100")];
    expect(customReadingNeedsRefresh("", live)).toBe(true);
    expect(customReadingNeedsRefresh("/amdcpu/0/load/0", live)).toBe(true);
    expect(customReadingNeedsRefresh("/hwinfo/e0000200/0/100", live)).toBe(false);
    expect(customReadingNeedsRefresh("/presentmon/presented", live)).toBe(false);
  });
});

describe("HWiNFO network labels", () => {
  it("treats DL/UP rate labels as download/upload", () => {
    expect(isDownloadSensorName("Current DL rate")).toBe(true);
    expect(isUploadSensorName("Current UP rate")).toBe(true);
    expect(isDownloadSensorName("Download")).toBe(true);
    expect(isUploadSensorName("CPU")).toBe(false);
  });
});

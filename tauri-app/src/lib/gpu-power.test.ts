import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { readGpuPower } from "./gpu";
import { SensorType, DEFAULT_SETTINGS } from "./types";
import { GpuSection } from "../components/overlay/GpuSection";
import type { HardwareMonitorData, OverlaySettings } from "./types";

const fixture = vi.hoisted(() => ({ state: {} as { settings: OverlaySettings; sensorData: HardwareMonitorData } }));
vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: (selector: (state: typeof fixture.state) => unknown) => selector(fixture.state),
}));

const power = { name: "GPU Package", identifier: "/gpu-nvidia/0/power/0", hardwareIdentifier: "/gpu-nvidia/0", sensorType: SensorType.Power, value: 65413 };

describe("GPU wattage", () => {
  it.each([65413, -123, NaN, Infinity, -Infinity])("rejects invalid sample %s", value => {
    expect(readGpuPower({ ...power, value }, power.hardwareIdentifier)).toBeNull();
  });
  it.each([0, 65.413, 600, 1200])("preserves valid watts %s without rescaling", value => {
    expect(readGpuPower({ ...power, value }, power.hardwareIdentifier)).toBe(value);
  });
  it("rejects missing, non-power and other-GPU readings", () => {
    expect(readGpuPower(undefined, power.hardwareIdentifier)).toBeNull();
    expect(readGpuPower({ ...power, value: 65, sensorType: SensorType.Load }, power.hardwareIdentifier)).toBeNull();
    expect(readGpuPower({ ...power, value: 65 }, "/gpu-amd/0")).toBeNull();
  });
  it("renders N/A for the reported sample and recovers on the next valid sample", () => {
      fixture.state = { settings: {
        ...DEFAULT_SETTINGS, selectedGpuId: power.hardwareIdentifier,
        sensors: { ...DEFAULT_SETTINGS.sensors, gpuConsumption: { ...DEFAULT_SETTINGS.sensors.gpuConsumption, isEnabled: true, customReadingId: power.identifier } },
      }, sensorData: { hardwares: [], sensors: [power], lastPollTime: 0 } };
      const render = () => renderToStaticMarkup(createElement(GpuSection, { isHorizontal: true }));
      expect(render()).toContain("N/A");
      expect(render()).not.toContain("65413");
      fixture.state.sensorData = { hardwares: [], sensors: [{ ...power, value: 65 }], lastPollTime: 0 };
      expect(render()).not.toContain("N/A");
      expect(render()).toContain(">65<");
  });
});

import { describe, it, expect } from "vitest";
import {
  getBoundaryColor,
  formatValue,
  formatClockLabel,
  cpuClockOptions,
  sensorDisplayName,
} from "./utils";
import type { Sensor } from "./types";
import { SensorType } from "./types";

const GREEN = "var(--green500)";
const YELLOW = "var(--yellow300)";
const RED = "var(--red500)";

// Thresholds are the UPPER bound of each segment, which is what the settings
// control paints: Low 0→low, Medium low→medium, High medium→high.
const B = { low: 20, medium: 40, high: 90 };

describe("getBoundaryColor", () => {
  it("matches the segments the settings control shows", () => {
    expect(getBoundaryColor(0, B)).toBe(GREEN);
    expect(getBoundaryColor(19, B)).toBe(GREEN);
    expect(getBoundaryColor(21, B)).toBe(YELLOW);
    expect(getBoundaryColor(39, B)).toBe(YELLOW);
    expect(getBoundaryColor(41, B)).toBe(RED);
    expect(getBoundaryColor(100, B)).toBe(RED);
  });

  it("treats each threshold as the last value inside its own segment", () => {
    expect(getBoundaryColor(20, B)).toBe(GREEN);
    expect(getBoundaryColor(40, B)).toBe(YELLOW);
  });

  it("never uses boundaries.high as a threshold — it is the scale top only", () => {
    // 89 and 91 sit either side of `high` and must look the same.
    expect(getBoundaryColor(89, B)).toBe(RED);
    expect(getBoundaryColor(91, B)).toBe(RED);
  });

  // KNOWN OPEN ISSUE — this test pins current behaviour, not desired behaviour.
  // If the gauge is changed to colour the same rounded number it prints, this
  // test is expected to fail and should be updated rather than treated as a
  // regression.
  it("colours the value it is given, which is NOT the value the overlay prints", () => {
    // The gauge prints formatValue(raw) but colours getBoundaryColor(raw), so a
    // reading just above a threshold prints as the threshold and still steps
    // to the next colour: the overlay reads "20 %" in yellow while the Low
    // segment is labelled 0-20.
    expect(formatValue(20.1)).toBe("20");
    expect(getBoundaryColor(20.1, B)).toBe(YELLOW);

    expect(formatValue(40.4)).toBe("40");
    expect(getBoundaryColor(40.4, B)).toBe(RED);
  });
});

describe("formatClockLabel", () => {
  const clock = (value: number): Sensor => ({
    name: "Cores _Average_",
    identifier: "/amdcpu/0/clock/1",
    hardwareIdentifier: "/amdcpu/0",
    sensorType: SensorType.Clock,
    value,
  });

  it("prints whole MHz for a real reading", () => {
    expect(formatClockLabel(clock(4347))).toBe("4347");
    // GPU memory clocks arrive fractional off the wire (5001.99 on an
    // RTX 4080 SUPER); the pill shows integer MHz.
    expect(formatClockLabel(clock(5001.99))).toBe("5002");
  });

  it("dashes when the sensor is absent from the frame", () => {
    // An unsupported CPU exposes no Clock sensors, and a modern AMD GPU
    // reports none until ADL's PMLog block has updated once.
    expect(formatClockLabel(undefined)).toBe("—");
  });

  it("dashes on 0, which is how a failed read arrives", () => {
    // The sidecar coalesces a null or NaN sensor value to 0f in MapSensor, so
    // 0 means "no reading". Nothing reports 0 MHz while it is running, and a
    // ">= 0" guard here would print "0 MHz" on a dead sensor instead.
    expect(formatClockLabel(clock(0))).toBe("—");
  });

  it("dashes on values that cannot be rendered", () => {
    expect(formatClockLabel(clock(NaN))).toBe("—");
    expect(formatClockLabel(clock(Infinity))).toBe("—");
    expect(formatClockLabel(clock(-1))).toBe("—");
  });
});

describe("cpuClockOptions", () => {
  const sensor = (index: number, name: string): Sensor => ({
    name,
    identifier: `/amdcpu/0/clock/${index}`,
    hardwareIdentifier: "/amdcpu/0",
    sensorType: SensorType.Clock,
    value: 4300,
  });
  // Zen activation order, as the sidecar emits the names.
  const zen = [
    sensor(0, "Bus Speed"),
    sensor(1, "Cores _Average_"),
    sensor(2, "Cores _Average Effective_"),
    sensor(3, "Core _1"),
    sensor(4, "Core _1 _Effective_"),
  ];

  it("drops Bus Speed and the Effective clocks", () => {
    expect(cpuClockOptions(zen, "").map((s) => s.name)).toEqual([
      "Cores _Average_",
      "Core _1",
    ]);
  });

  it("keeps a hidden sensor that is already selected", () => {
    expect(cpuClockOptions(zen, "/amdcpu/0/clock/4").map((s) => s.name)).toEqual([
      "Cores _Average_",
      "Core _1",
      "Core _1 _Effective_",
    ]);
  });
});

describe("sensorDisplayName", () => {
  it("restores the clock names the sidecar sanitised", () => {
    expect(sensorDisplayName("Cores _Average_")).toBe("Cores (Average)");
    expect(sensorDisplayName("Core _1 _Effective_")).toBe("Core #1 (Effective)");
    expect(sensorDisplayName("CPU Core _12")).toBe("CPU Core #12");
    expect(sensorDisplayName("P_Core _3")).toBe("P-Core #3");
    expect(sensorDisplayName("E_Core _8")).toBe("E-Core #8");
  });

  it("leaves names it cannot restore unambiguously", () => {
    expect(sensorDisplayName("GPU Core")).toBe("GPU Core");
    expect(sensorDisplayName("Core _Tctl_Tdie_")).toBe("Core _Tctl_Tdie_");
    expect(sensorDisplayName("Bus Speed")).toBe("Bus Speed");
  });
});

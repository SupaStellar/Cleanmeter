import { describe, it, expect } from "vitest";
import {
  isGpu,
  isGpuReportingNothing,
  listGpus,
  nextGpuSilence,
  NO_GPU_SILENCE,
  pickDefaultGpu,
  resolveSelectedGpu,
  sensorsOnGpu,
  shouldRepickSensor,
  type GpuSilence,
} from "./gpu";
import type { Hardware, Sensor } from "./types";
import { HardwareType, SensorType } from "./types";

// The machine from issue #48: an RTX 3050 laptop GPU alongside Intel
// integrated graphics. Sensor names are the ones LibreHardwareMonitor 0.9.6
// actually produces, which is the point of the fixture: NVIDIA and Intel both
// expose a temperature called "GPU Core", so nothing but the hardware
// identifier separates them.
const NVIDIA: Hardware = {
  name: "NVIDIA GeForce RTX 3050 Laptop GPU",
  identifier: "/gpu-nvidia/0",
  hardwareType: HardwareType.GpuNvidia,
};

const INTEL: Hardware = {
  name: "Intel(R) UHD Graphics",
  identifier: "/gpu-intel/0",
  hardwareType: HardwareType.GpuIntel,
};

const CPU: Hardware = {
  name: "Intel Core i5-11400H",
  identifier: "/intelcpu/0",
  hardwareType: HardwareType.Cpu,
};

function sensor(
  hardwareIdentifier: string,
  identifier: string,
  name: string,
  sensorType: SensorType,
  value = 0,
): Sensor {
  return { name, identifier, hardwareIdentifier, sensorType, value };
}

const NVIDIA_SENSORS = [
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 42),
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/1", "GPU Memory Controller", SensorType.Load, 12),
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 61),
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/power/0", "GPU Package", SensorType.Power, 55),
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/1", "GPU Memory Used", SensorType.SmallData, 2048),
  sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/2", "GPU Memory Total", SensorType.SmallData, 4096),
];

// Intel exposes its load through D3D engine nodes and has no memory of its
// own, so its only "total" is the system memory it may borrow.
const INTEL_SENSORS = [
  sensor("/gpu-intel/0", "/gpu-intel/0/load/0", "D3D 3D", SensorType.Load, 7),
  sensor("/gpu-intel/0", "/gpu-intel/0/temperature/0", "GPU Core", SensorType.Temperature, 45),
  sensor("/gpu-intel/0", "/gpu-intel/0/power/0", "GPU Power", SensorType.Power, 4),
  sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/3", "D3D Shared Memory Total", SensorType.SmallData, 16384),
];

const ALL_SENSORS = [...NVIDIA_SENSORS, ...INTEL_SENSORS];

describe("listGpus", () => {
  it("keeps GPUs and drops everything else", () => {
    expect(listGpus([CPU, NVIDIA, INTEL]).map((g) => g.identifier)).toEqual([
      "/gpu-nvidia/0",
      "/gpu-intel/0",
    ]);
  });

  it("preserves the order the sidecar sent", () => {
    expect(listGpus([INTEL, NVIDIA])[0].identifier).toBe("/gpu-intel/0");
  });

  it("recognises all three GPU vendors", () => {
    const amd = { ...NVIDIA, hardwareType: HardwareType.GpuAmd };
    expect(isGpu(NVIDIA)).toBe(true);
    expect(isGpu(INTEL)).toBe(true);
    expect(isGpu(amd)).toBe(true);
    expect(isGpu(CPU)).toBe(false);
  });
});

describe("sensorsOnGpu", () => {
  it("returns only that GPU's sensors", () => {
    const scoped = sensorsOnGpu(ALL_SENSORS, "/gpu-nvidia/0");
    expect(scoped).toHaveLength(NVIDIA_SENSORS.length);
    expect(scoped.every((s) => s.hardwareIdentifier === "/gpu-nvidia/0")).toBe(true);
  });

  it("separates the two identically-named GPU Core temperatures", () => {
    const nvidia = sensorsOnGpu(ALL_SENSORS, "/gpu-nvidia/0").filter(
      (s) => s.sensorType === SensorType.Temperature,
    );
    const intel = sensorsOnGpu(ALL_SENSORS, "/gpu-intel/0").filter(
      (s) => s.sensorType === SensorType.Temperature,
    );

    expect(nvidia).toHaveLength(1);
    expect(intel).toHaveLength(1);
    expect(nvidia[0].name).toBe(intel[0].name);
    expect(nvidia[0].identifier).not.toBe(intel[0].identifier);
  });

  it("is empty for a GPU with no readings, and for no GPU at all", () => {
    expect(sensorsOnGpu(ALL_SENSORS, "/gpu-absent/10DE-2507-0")).toEqual([]);
    expect(sensorsOnGpu(ALL_SENSORS, "")).toEqual([]);
  });
});

describe("pickDefaultGpu", () => {
  it("prefers the discrete GPU over integrated graphics", () => {
    expect(pickDefaultGpu([NVIDIA, INTEL], ALL_SENSORS)).toBe("/gpu-nvidia/0");
  });

  it("still prefers it when the integrated GPU is listed first", () => {
    expect(pickDefaultGpu([INTEL, NVIDIA], ALL_SENSORS)).toBe("/gpu-nvidia/0");
  });

  it("ignores shared memory, which is system RAM and dwarfs real VRAM", () => {
    // Intel's shared total is 16384 against the NVIDIA card's dedicated 4096.
    // Counting it would pick the integrated GPU on every laptop.
    const intelShared = ALL_SENSORS.find((s) => s.name === "D3D Shared Memory Total");
    expect(intelShared?.value).toBeGreaterThan(4096);
    expect(pickDefaultGpu([NVIDIA, INTEL], ALL_SENSORS)).toBe("/gpu-nvidia/0");
  });

  it("prefers a non-Intel GPU when no memory reading has arrived yet", () => {
    // First launch: sensors activate over the first few polls rather than all
    // at once, so the tie-break has to hold with nothing to rank on.
    expect(pickDefaultGpu([INTEL, NVIDIA], [])).toBe("/gpu-nvidia/0");
  });

  it("ranks two discrete GPUs by dedicated memory", () => {
    const second: Hardware = {
      name: "NVIDIA GeForce RTX 4090",
      identifier: "/gpu-nvidia/1",
      hardwareType: HardwareType.GpuNvidia,
    };
    const sensors = [
      ...NVIDIA_SENSORS,
      sensor("/gpu-nvidia/1", "/gpu-nvidia/1/smalldata/2", "GPU Memory Total", SensorType.SmallData, 24576),
    ];

    expect(pickDefaultGpu([NVIDIA, second], sensors)).toBe("/gpu-nvidia/1");
  });

  it("separates an AMD integrated GPU from an AMD card by memory, not by type", () => {
    // Both report as GpuAmd, so hardware type cannot tell them apart.
    const apu: Hardware = { name: "AMD Radeon Graphics", identifier: "/gpu-amd/0", hardwareType: HardwareType.GpuAmd };
    const card: Hardware = { name: "AMD Radeon RX 7900 XT", identifier: "/gpu-amd/1", hardwareType: HardwareType.GpuAmd };
    const sensors = [
      sensor("/gpu-amd/0", "/gpu-amd/0/smalldata/2", "GPU Memory Total", SensorType.SmallData, 512),
      sensor("/gpu-amd/1", "/gpu-amd/1/smalldata/2", "GPU Memory Total", SensorType.SmallData, 20480),
    ];

    expect(pickDefaultGpu([apu, card], sensors)).toBe("/gpu-amd/1");
  });

  it("returns the only GPU when there is one, and empty when there are none", () => {
    expect(pickDefaultGpu([NVIDIA], ALL_SENSORS)).toBe("/gpu-nvidia/0");
    expect(pickDefaultGpu([], ALL_SENSORS)).toBe("");
  });
});

describe("resolveSelectedGpu", () => {
  it("keeps a stored choice that still resolves", () => {
    expect(resolveSelectedGpu("/gpu-intel/0", "", [NVIDIA, INTEL], ALL_SENSORS)).toBe("/gpu-intel/0");
  });

  it("keeps the stored choice even when it disagrees with the default", () => {
    // Choosing the integrated GPU on purpose has to survive every reload.
    expect(resolveSelectedGpu("/gpu-intel/0", "/gpu-nvidia/0/load/0", [NVIDIA, INTEL], ALL_SENSORS))
      .toBe("/gpu-intel/0");
  });

  it("adopts the GPU behind the saved GPU Usage sensor when nothing is stored", () => {
    // The upgrade path: settings written before this control existed.
    expect(resolveSelectedGpu("", "/gpu-intel/0/load/0", [NVIDIA, INTEL], ALL_SENSORS))
      .toBe("/gpu-intel/0");
  });

  it("falls back to the default when the stored GPU is gone", () => {
    expect(resolveSelectedGpu("/gpu-amd/9", "", [NVIDIA, INTEL], ALL_SENSORS)).toBe("/gpu-nvidia/0");
  });

  it("falls back to the default when the anchor sensor is gone too", () => {
    expect(resolveSelectedGpu("", "/gpu-amd/9/load/0", [NVIDIA, INTEL], ALL_SENSORS))
      .toBe("/gpu-nvidia/0");
  });

  it("leaves the stored value alone when no GPU is reported at all", () => {
    // A sidecar that has not finished enumerating must not clear a valid
    // choice, or every restart would reset the user's GPU.
    expect(resolveSelectedGpu("/gpu-nvidia/0", "", [], [])).toBe("/gpu-nvidia/0");
  });

  it("selects a GPU that has no readings, so it can still be chosen", () => {
    const absent: Hardware = {
      name: "NVIDIA GeForce RTX 3050 Laptop GPU",
      identifier: "/gpu-absent/10DE-2507-0",
      hardwareType: HardwareType.GpuNvidia,
    };
    expect(resolveSelectedGpu("/gpu-absent/10DE-2507-0", "", [absent, INTEL], INTEL_SENSORS))
      .toBe("/gpu-absent/10DE-2507-0");
  });
});

describe("isGpuReportingNothing", () => {
  it("is false for a GPU that is reporting", () => {
    expect(isGpuReportingNothing("/gpu-nvidia/0", ALL_SENSORS)).toBe(false);
  });

  it("is true for a GPU with no sensors at all", () => {
    // Parked, or its vendor SDK never answered, so it exists only because the
    // device tree reported it.
    expect(isGpuReportingNothing("/gpu-absent/10DE-2507-0", ALL_SENSORS)).toBe(true);
  });

  it("is true when every sensor on the GPU reads 0", () => {
    const parked = [
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 0),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 0),
      ...INTEL_SENSORS,
    ];
    expect(isGpuReportingNothing("/gpu-nvidia/0", parked)).toBe(true);
  });

  it("is false for a GPU at 0% load that still reports temperature", () => {
    // Awake and reporting perfectly well, just not busy. Nothing to explain.
    const idleButAwake = [
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 0),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 45),
    ];
    expect(isGpuReportingNothing("/gpu-nvidia/0", idleButAwake)).toBe(false);
  });

  it("is true before any sensor has arrived, which is why callers must not render off it", () => {
    // Indistinguishable from a parked GPU in a single snapshot. Separating the
    // two is nextGpuSilence's job, not this one's.
    expect(isGpuReportingNothing("/gpu-nvidia/0", [])).toBe(true);
  });

  it("is false when no GPU is selected", () => {
    expect(isGpuReportingNothing("", ALL_SENSORS)).toBe(false);
  });
});

describe("nextGpuSilence", () => {
  const quiet: Sensor[] = [];
  const advance = (
    state: GpuSilence,
    gpuId: string,
    sensors: Sensor[],
    now: number,
  ) => nextGpuSilence(state, gpuId, sensors, now, 2000);

  it("does not settle while the GPU is still within the dwell", () => {
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 1000);
    expect(state.settled).toBe(false);

    state = advance(state, "/gpu-nvidia/0", quiet, 2500);
    expect(state.settled).toBe(false);
  });

  it("settles once the GPU has been quiet for the whole dwell", () => {
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 1000);
    state = advance(state, "/gpu-nvidia/0", quiet, 3000);
    expect(state.settled).toBe(true);
  });

  it("never settles for a GPU whose sensors merely arrive late", () => {
    // The case the old snapshot-only check got wrong. CPU and RAM sensors
    // activate before GPU ones, and an AMD GPU reads through a sampling session
    // with no sample on the first Update, so a healthy GPU looks silent for a
    // poll or two. At a 500ms rate that is four polls before the dwell expires.
    const cpuOnly = [sensor("/amdcpu/0", "/amdcpu/0/load/0", "CPU Total", SensorType.Load, 20)];

    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", cpuOnly, 0);
    for (const t of [500, 1000, 1500]) {
      state = advance(state, "/gpu-nvidia/0", cpuOnly, t);
      expect(state.settled).toBe(false);
    }

    // Sensors activate before the dwell expires, so nothing is ever shown.
    state = advance(state, "/gpu-nvidia/0", ALL_SENSORS, 1800);
    expect(state.settled).toBe(false);
    expect(state.since).toBeNull();
  });

  it("forgives instantly on a single reading", () => {
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 0);
    state = advance(state, "/gpu-nvidia/0", quiet, 5000);
    expect(state.settled).toBe(true);

    state = advance(state, "/gpu-nvidia/0", ALL_SENSORS, 5100);
    expect(state.settled).toBe(false);
    expect(state.since).toBeNull();
  });

  it("restarts the clock when the selected GPU changes", () => {
    // Switching must not inherit an age the new GPU never earned, or a freshly
    // chosen GPU would be accused the moment it is picked.
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 0);
    state = advance(state, "/gpu-nvidia/0", quiet, 5000);
    expect(state.settled).toBe(true);

    state = advance(state, "/gpu-intel/0", quiet, 5100);
    expect(state.settled).toBe(false);
    expect(state.since).toBe(5100);
  });

  it("keeps timing across polls rather than restarting each one", () => {
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 0);
    for (const t of [500, 1000, 1500]) state = advance(state, "/gpu-nvidia/0", quiet, t);
    expect(state.since).toBe(0);
    expect(state.settled).toBe(false);

    state = advance(state, "/gpu-nvidia/0", quiet, 2000);
    expect(state.settled).toBe(true);
  });

  it("resets when no GPU is selected", () => {
    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", quiet, 0);
    state = advance(state, "", quiet, 5000);
    expect(state).toEqual(NO_GPU_SILENCE);
  });

  it("settles for a GPU that is present but reporting all zeros", () => {
    const parked = [
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 0),
      sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 0),
    ];

    let state = advance(NO_GPU_SILENCE, "/gpu-nvidia/0", parked, 0);
    state = advance(state, "/gpu-nvidia/0", parked, 2000);
    expect(state.settled).toBe(true);
  });
});

describe("shouldRepickSensor", () => {
  it("leaves a choice already on the selected GPU alone", () => {
    expect(shouldRepickSensor("/gpu-nvidia/0/load/0", "/gpu-nvidia/0", ALL_SENSORS)).toBe(false);
  });

  it("replaces a choice that sits on a different GPU", () => {
    // The repair path: settings written before the GPU was pinned.
    expect(shouldRepickSensor("/gpu-nvidia/0/load/0", "/gpu-intel/0", ALL_SENSORS)).toBe(true);
  });

  it("picks something when nothing is chosen", () => {
    expect(shouldRepickSensor("", "/gpu-nvidia/0", ALL_SENSORS)).toBe(true);
  });

  it("leaves a choice alone when its sensor is not in this snapshot", () => {
    // LibreHardwareMonitor only exposes a sensor once it has produced a
    // reading, and AMD GPUs read through a sampling session with no sample on
    // the first update. Re-picking here would wipe a deliberate choice on the
    // strength of a snapshot that had not caught up yet.
    expect(shouldRepickSensor("/gpu-amd/0/temperature/0", "/gpu-amd/0", [])).toBe(false);
    expect(shouldRepickSensor("/gpu-nvidia/0/load/99", "/gpu-nvidia/0", ALL_SENSORS)).toBe(false);
  });

  it("replaces an off-GPU choice even when the selected GPU has no sensors", () => {
    // Selecting a powered-down GPU must stop the old GPU's numbers being
    // shown under its name. The row ends up empty, and reads 0.
    expect(shouldRepickSensor("/gpu-intel/0/load/0", "/gpu-absent/10DE-2507-0", ALL_SENSORS))
      .toBe(true);
  });
});

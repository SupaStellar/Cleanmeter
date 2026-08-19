import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Hardware, HardwareMonitorData, OverlaySettings, Sensor } from "@/lib/types";
import { DEFAULT_SETTINGS, HardwareType, SensorType } from "@/lib/types";

// The store talks to Tauri on every settings write, and lib/tauri reads
// `window` at import time, which does not exist in the node test project.
// Nothing here asserts on those calls; they only need to not throw.
vi.mock("@/lib/tauri", () => ({
  isBrowser: true,
  clearSettings: vi.fn(),
  getAppVersion: vi.fn(),
  getPreferences: vi.fn(),
  getSettings: vi.fn(),
  getSidecarStatus: vi.fn(),
  savePreferences: vi.fn(),
  saveSettings: vi.fn(),
  selectPresentMonApp: vi.fn(),
  setOverlayOpacity: vi.fn(),
  setOverlayVisible: vi.fn(),
  setPollingRate: vi.fn(),
}));

const { useSettingsStore } = await import("./settings-store");

/**
 * The machine from issue #48. Both GPUs expose a temperature called
 * "GPU Core", which is exactly why the identifier is the only thing that can
 * separate them.
 */
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

function sensor(
  hw: string,
  id: string,
  name: string,
  sensorType: SensorType,
  value = 1,
): Sensor {
  return { name, identifier: id, hardwareIdentifier: hw, sensorType, value };
}

const DATA: HardwareMonitorData = {
  hardwares: [NVIDIA, INTEL],
  lastPollTime: 0,
  sensors: [
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", SensorType.Load, 40),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/3", "GPU Memory", SensorType.Load, 30),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", SensorType.Temperature, 60),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/power/0", "GPU Package", SensorType.Power, 70),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/1", "GPU Memory Used", SensorType.SmallData, 2048),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/2", "GPU Memory Total", SensorType.SmallData, 4096),

    sensor("/gpu-intel/0", "/gpu-intel/0/load/0", "D3D 3D", SensorType.Load, 5),
    sensor("/gpu-intel/0", "/gpu-intel/0/load/1", "D3D Memory", SensorType.Load, 3),
    sensor("/gpu-intel/0", "/gpu-intel/0/temperature/0", "GPU Core", SensorType.Temperature, 44),
    sensor("/gpu-intel/0", "/gpu-intel/0/power/0", "GPU Power", SensorType.Power, 4),
    sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/0", "D3D Shared Memory Total", SensorType.SmallData, 16384),
  ],
};

function seed(settings: Partial<OverlaySettings>) {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, ...settings },
    sensorData: null,
    overlayVisible: true,
  });
}

function gpuRows() {
  const { sensors, selectedGpuId } = useSettingsStore.getState().settings;
  return {
    selectedGpuId,
    gpuUsage: sensors.gpuUsage.customReadingId,
    gpuTemp: sensors.gpuTemp.customReadingId,
    gpuConsumption: sensors.gpuConsumption.customReadingId,
    vramUsage: sensors.vramUsage.customReadingId,
    totalVramUsed: sensors.totalVramUsed.customReadingId,
  };
}

/** Every GPU row names a sensor on `gpuId`, or names nothing at all. */
function allRowsOn(gpuId: string) {
  const rows = gpuRows();
  return [rows.gpuUsage, rows.gpuTemp, rows.gpuConsumption, rows.vramUsage, rows.totalVramUsed]
    .filter(Boolean)
    .every((id) => id.startsWith(gpuId));
}

beforeEach(() => {
  seed({});
});

describe("choosing a GPU on a two-GPU machine", () => {
  it("picks the discrete GPU on a fresh install", () => {
    useSettingsStore.getState().setSensorData(DATA);

    expect(gpuRows().selectedGpuId).toBe("/gpu-nvidia/0");
    expect(allRowsOn("/gpu-nvidia/0")).toBe(true);
  });

  it("fills every GPU row rather than only some", () => {
    useSettingsStore.getState().setSensorData(DATA);

    const rows = gpuRows();
    expect(rows.gpuUsage).toBe("/gpu-nvidia/0/load/0");
    expect(rows.gpuTemp).toBe("/gpu-nvidia/0/temperature/0");
    expect(rows.gpuConsumption).toBe("/gpu-nvidia/0/power/0");
    expect(rows.totalVramUsed).toBe("/gpu-nvidia/0/smalldata/1");
  });
});

describe("upgrading an existing install", () => {
  it("repairs a configuration split across two GPUs", () => {
    // Reachable today: gpuUsage and gpuTemp match on different keywords over
    // one unscoped list, so nothing stopped them landing on different GPUs.
    seed({
      sensors: {
        ...DEFAULT_SETTINGS.sensors,
        gpuUsage: { ...DEFAULT_SETTINGS.sensors.gpuUsage, customReadingId: "/gpu-nvidia/0/load/0" },
        gpuTemp: { ...DEFAULT_SETTINGS.sensors.gpuTemp, customReadingId: "/gpu-intel/0/temperature/0" },
      },
    });

    useSettingsStore.getState().setSensorData(DATA);

    const rows = gpuRows();
    expect(rows.selectedGpuId).toBe("/gpu-nvidia/0");
    expect(rows.gpuTemp).toBe("/gpu-nvidia/0/temperature/0");
    expect(allRowsOn("/gpu-nvidia/0")).toBe(true);
  });

  it("adopts the GPU behind the saved GPU Usage sensor, even the integrated one", () => {
    // Someone reading integrated-GPU load before this existed keeps reading it.
    seed({
      sensors: {
        ...DEFAULT_SETTINGS.sensors,
        gpuUsage: { ...DEFAULT_SETTINGS.sensors.gpuUsage, customReadingId: "/gpu-intel/0/load/0" },
      },
    });

    useSettingsStore.getState().setSensorData(DATA);

    expect(gpuRows().selectedGpuId).toBe("/gpu-intel/0");
    expect(allRowsOn("/gpu-intel/0")).toBe(true);
  });

  it("keeps a deliberate GPU choice that disagrees with the default", () => {
    seed({ selectedGpuId: "/gpu-intel/0" });

    useSettingsStore.getState().setSensorData(DATA);

    expect(gpuRows().selectedGpuId).toBe("/gpu-intel/0");
    expect(allRowsOn("/gpu-intel/0")).toBe(true);
  });

  it("keeps a hand-picked sensor that is already on the selected GPU", () => {
    // "GPU Memory" is not what the keyword order would choose for vramUsage,
    // so this only stays put if a valid on-GPU choice is left alone.
    seed({
      selectedGpuId: "/gpu-nvidia/0",
      sensors: {
        ...DEFAULT_SETTINGS.sensors,
        vramUsage: { ...DEFAULT_SETTINGS.sensors.vramUsage, customReadingId: "/gpu-nvidia/0/load/3" },
      },
    });

    useSettingsStore.getState().setSensorData(DATA);

    expect(gpuRows().vramUsage).toBe("/gpu-nvidia/0/load/3");
  });

  it("leaves a choice alone when its sensor has not arrived yet", () => {
    // AMD activates temperature, power and load a poll or two late. Re-picking
    // on a snapshot that has not caught up would destroy the saved choice.
    const late = "/gpu-nvidia/0/temperature/9";
    seed({
      selectedGpuId: "/gpu-nvidia/0",
      sensors: {
        ...DEFAULT_SETTINGS.sensors,
        gpuTemp: { ...DEFAULT_SETTINGS.sensors.gpuTemp, customReadingId: late },
      },
    });

    useSettingsStore.getState().setSensorData(DATA);

    expect(gpuRows().gpuTemp).toBe(late);
  });
});

describe("selectGpu", () => {
  it("moves every GPU row onto the newly chosen GPU in one update", () => {
    useSettingsStore.getState().setSensorData(DATA);
    expect(gpuRows().selectedGpuId).toBe("/gpu-nvidia/0");

    useSettingsStore.getState().selectGpu("/gpu-intel/0");

    const rows = gpuRows();
    expect(rows.selectedGpuId).toBe("/gpu-intel/0");
    expect(rows.gpuUsage).toBe("/gpu-intel/0/load/0");
    expect(rows.gpuTemp).toBe("/gpu-intel/0/temperature/0");
    expect(rows.gpuConsumption).toBe("/gpu-intel/0/power/0");
    expect(allRowsOn("/gpu-intel/0")).toBe(true);
  });

  it("clears the rows when the chosen GPU has no readings, rather than keeping the old GPU's", () => {
    // A GPU the device tree reports but LibreHardwareMonitor produced nothing
    // for. Showing 0 under its name is honest; showing the other GPU's numbers
    // under its name is the bug this whole change removes.
    const absent: Hardware = {
      name: "NVIDIA GeForce RTX 3050 Laptop GPU",
      identifier: "/gpu-absent/10DE-2507-0",
      hardwareType: HardwareType.GpuNvidia,
    };

    useSettingsStore.getState().setSensorData({ ...DATA, hardwares: [absent, INTEL] });
    useSettingsStore.getState().selectGpu("/gpu-absent/10DE-2507-0");

    const rows = gpuRows();
    expect(rows.selectedGpuId).toBe("/gpu-absent/10DE-2507-0");
    expect(rows.gpuUsage).toBe("");
    expect(rows.gpuTemp).toBe("");
    expect(rows.gpuConsumption).toBe("");
    expect(rows.totalVramUsed).toBe("");
  });
});

/**
 * The exact payload a two-GPU laptop puts on the wire, transcribed from a
 * running sidecar rather than invented here: hardware order, sensor names,
 * identifiers, sensor-type numbers and values all copied from the dump.
 *
 * This exists because the other fixtures in this file are what I *believed*
 * the wire looked like, and a fixture that agrees with the code but not with
 * the wire cannot catch a mismatch between them.
 */
const WIRE: HardwareMonitorData = {
  lastPollTime: 0,
  hardwares: [
    { name: "NVIDIA GeForce RTX 3050 Laptop GPU", identifier: "/gpu-nvidia/0", hardwareType: 4 },
    { name: "Intel R UHD Graphics", identifier: "/gpu-intel/0", hardwareType: 6 },
    { name: "Intel Core i5 11400H", identifier: "/intelcpu/0", hardwareType: 2 },
    { name: "Total Memory", identifier: "/ram", hardwareType: 3 },
    { name: "Ethernet", identifier: "/nic/0", hardwareType: 8 },
  ],
  sensors: [
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/0", "GPU Core", 5, 42),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/1", "GPU Memory Controller", 5, 12),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/load/3", "GPU Memory", 5, 30),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/0", "GPU Core", 4, 61),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/temperature/1", "GPU Hot Spot", 4, 73),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/power/0", "GPU Package", 2, 55),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/1", "GPU Memory Used", 13, 2048),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/2", "GPU Memory Total", 13, 4096),
    sensor("/gpu-nvidia/0", "/gpu-nvidia/0/smalldata/9", "D3D Dedicated Memory Used", 13, 2048),
    sensor("/gpu-intel/0", "/gpu-intel/0/load/0", "D3D 3D", 5, 7),
    sensor("/gpu-intel/0", "/gpu-intel/0/load/1", "D3D Video Decode", 5, 3),
    sensor("/gpu-intel/0", "/gpu-intel/0/temperature/0", "GPU Core", 4, 45),
    sensor("/gpu-intel/0", "/gpu-intel/0/power/0", "GPU Power", 2, 4),
    sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/0", "D3D Shared Memory Total", 13, 16384),
    sensor("/gpu-intel/0", "/gpu-intel/0/smalldata/1", "D3D Shared Memory Used", 13, 900),
    sensor("/intelcpu/0", "/intelcpu/0/load/0", "CPU Total", 5, 33),
    sensor("/intelcpu/0", "/intelcpu/0/temperature/0", "CPU Package", 4, 52),
    sensor("/intelcpu/0", "/intelcpu/0/power/0", "CPU Package", 2, 65),
    sensor("/ram", "/ram/load/0", "Memory Used", 5, 48),
    sensor("/nic/0", "/nic/0/throughput/7", "Download Speed", 14, 1234),
    sensor("/nic/0", "/nic/0/throughput/8", "Upload Speed", 14, 567),
    sensor("/presentmon", "/presentmon/presented", "Presented", 5, 144),
    sensor("/presentmon", "/presentmon/frametime", "Frametime", 5, 6.94),
  ],
};

describe("the payload a real two-GPU sidecar sends", () => {
  it("lands on the discrete GPU, matching what the running app chose", () => {
    useSettingsStore.getState().setSensorData(WIRE);

    const rows = gpuRows();
    expect(rows.selectedGpuId).toBe("/gpu-nvidia/0");
    expect(rows.gpuUsage).toBe("/gpu-nvidia/0/load/0");
    expect(rows.gpuTemp).toBe("/gpu-nvidia/0/temperature/0");
    expect(rows.gpuConsumption).toBe("/gpu-nvidia/0/power/0");
    expect(rows.totalVramUsed).toBe("/gpu-nvidia/0/smalldata/1");
  });

  it("does not let the integrated GPU win on borrowed system memory", () => {
    // Intel's only "memory total" is 16384 MB of shared system RAM against the
    // discrete card's 4096 MB of its own. Counting shared memory would pick
    // the integrated GPU on essentially every laptop.
    useSettingsStore.getState().setSensorData(WIRE);
    expect(gpuRows().selectedGpuId).toBe("/gpu-nvidia/0");
  });

  it("leaves every non-GPU reading alone", () => {
    useSettingsStore.getState().setSensorData(WIRE);

    const { sensors } = useSettingsStore.getState().settings;
    expect(sensors.cpuUsage.customReadingId).toBe("/intelcpu/0/load/0");
    expect(sensors.cpuTemp.customReadingId).toBe("/intelcpu/0/temperature/0");
    expect(sensors.cpuConsumption.customReadingId).toBe("/intelcpu/0/power/0");
    expect(sensors.ramUsage.customReadingId).toBe("/ram/load/0");
    expect(sensors.downRate.customReadingId).toBe("/nic/0/throughput/7");
    expect(sensors.upRate.customReadingId).toBe("/nic/0/throughput/8");
    expect(sensors.framerate.customReadingId).toBe("/presentmon/presented");
    expect(sensors.frametime.customReadingId).toBe("/presentmon/frametime");
  });

  it("moves every GPU row to the integrated GPU when it is chosen", () => {
    useSettingsStore.getState().setSensorData(WIRE);
    useSettingsStore.getState().selectGpu("/gpu-intel/0");

    const rows = gpuRows();
    expect(rows.gpuUsage).toBe("/gpu-intel/0/load/0");
    expect(rows.gpuTemp).toBe("/gpu-intel/0/temperature/0");
    expect(rows.gpuConsumption).toBe("/gpu-intel/0/power/0");
    expect(allRowsOn("/gpu-intel/0")).toBe(true);
  });
});

describe("the idle notice", () => {
  it("does not carry the old GPU's verdict across a switch", () => {
    // Silence is timed per GPU. If selectGpu left the previous GPU's verdict
    // in place, switching away from a parked GPU would leave its "reports 0"
    // notice sitting under a GPU that is reading fine until the next poll.
    const parkedNvidia: HardwareMonitorData = {
      ...DATA,
      sensors: DATA.sensors.filter((s) => s.hardwareIdentifier !== "/gpu-nvidia/0"),
    };

    useSettingsStore.getState().setSensorData(parkedNvidia);
    expect(useSettingsStore.getState().gpuSilence.gpuId).toBe("/gpu-nvidia/0");

    useSettingsStore.getState().selectGpu("/gpu-intel/0");

    const silence = useSettingsStore.getState().gpuSilence;
    expect(silence.gpuId).toBe("/gpu-intel/0");
    expect(silence.settled).toBe(false);
    expect(silence.since).toBeNull();
  });

  it("starts timing immediately when switching to a GPU that reports nothing", () => {
    const parkedNvidia: HardwareMonitorData = {
      ...DATA,
      sensors: DATA.sensors.filter((s) => s.hardwareIdentifier !== "/gpu-nvidia/0"),
    };

    useSettingsStore.getState().setSensorData(parkedNvidia);
    useSettingsStore.getState().selectGpu("/gpu-intel/0");
    useSettingsStore.getState().selectGpu("/gpu-nvidia/0");

    const silence = useSettingsStore.getState().gpuSilence;
    expect(silence.gpuId).toBe("/gpu-nvidia/0");
    // Timing has begun, but nothing is claimed yet.
    expect(silence.since).not.toBeNull();
    expect(silence.settled).toBe(false);
  });
});

describe("single-GPU machines", () => {
  it("still resolve a GPU, so the overlay anchors VRAM to something", () => {
    useSettingsStore.getState().setSensorData({ ...DATA, hardwares: [NVIDIA] });

    expect(gpuRows().selectedGpuId).toBe("/gpu-nvidia/0");
    expect(allRowsOn("/gpu-nvidia/0")).toBe(true);
  });

  it("leave CPU and RAM rows to the unscoped picker", () => {
    // The GPU scoping must not touch anything that is not a GPU.
    const withCpu: HardwareMonitorData = {
      ...DATA,
      hardwares: [NVIDIA, { name: "CPU", identifier: "/amdcpu/0", hardwareType: HardwareType.Cpu }],
      sensors: [
        ...DATA.sensors,
        sensor("/amdcpu/0", "/amdcpu/0/load/0", "CPU Total", SensorType.Load, 20),
      ],
    };

    useSettingsStore.getState().setSensorData(withCpu);

    expect(useSettingsStore.getState().settings.sensors.cpuUsage.customReadingId)
      .toBe("/amdcpu/0/load/0");
  });
});

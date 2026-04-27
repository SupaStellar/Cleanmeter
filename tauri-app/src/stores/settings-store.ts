import { create } from "zustand";
import type {
  OverlaySettings,
  HardwareMonitorData,
  PipeStatus,
  SensorKey,
  SensorConfig,
  GraphSensorConfig,
  Boundaries,
  AppPreferences,
  Sensor,
  Hardware,
} from "@/lib/types";
import { DEFAULT_SETTINGS, HardwareType, SensorType } from "@/lib/types";
import * as tauri from "@/lib/tauri";

function findBest(
  sensors: Sensor[],
  hardwares: Hardware[],
  hwTypes: HardwareType[],
  sensorType: SensorType,
  prefer: string[]
): string {
  const hwIds = new Set(
    hardwares.filter((h) => hwTypes.includes(h.hardwareType)).map((h) => h.identifier)
  );
  const candidates = sensors.filter(
    (s) => hwIds.has(s.hardwareIdentifier) && s.sensorType === sensorType
  );
  if (candidates.length === 0) return "";
  for (const keyword of prefer) {
    const match = candidates.find((s) =>
      s.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) return match.identifier;
  }
  return candidates[0].identifier;
}

function autoSelectSensors(
  data: HardwareMonitorData,
  settings: OverlaySettings
): Partial<OverlaySettings["sensors"]> | null {
  const { sensors, hardwares } = data;
  const patch: Partial<OverlaySettings["sensors"]> = {};
  let changed = false;

  const cpuHw = [HardwareType.Cpu];
  const gpuHw = [HardwareType.GpuNvidia, HardwareType.GpuAmd, HardwareType.GpuIntel];
  const netHw = [HardwareType.Network];

  const tryFill = (
    key: SensorKey,
    hwTypes: HardwareType[],
    sType: SensorType,
    prefer: string[]
  ) => {
    const current = settings.sensors[key];
    if (!current.customReadingId) {
      const id = findBest(sensors, hardwares, hwTypes, sType, prefer);
      if (id) {
        patch[key] = { ...current, customReadingId: id } as any;
        changed = true;
      }
    }
  };

  tryFill("cpuUsage", cpuHw, SensorType.Load, ["CPU Total", "CPU Package", "CPU"]);
  tryFill("cpuTemp", cpuHw, SensorType.Temperature, ["CPU Package", "CPU Core", "CPU"]);
  tryFill("cpuConsumption", cpuHw, SensorType.Power, ["CPU Package", "CPU"]);
  tryFill("gpuUsage", gpuHw, SensorType.Load, ["GPU Core", "D3D 3D", "GPU"]);
  tryFill("gpuTemp", gpuHw, SensorType.Temperature, ["GPU Core", "GPU"]);
  tryFill("vramUsage", gpuHw, SensorType.Load, ["GPU Memory", "Memory"]);
  tryFill("totalVramUsed", gpuHw, SensorType.SmallData, ["GPU Memory Used", "Memory Used", "VRAM"]);
  tryFill("gpuConsumption", gpuHw, SensorType.Power, ["GPU Package", "GPU Power", "GPU"]);
  tryFill("ramUsage", [HardwareType.Memory], SensorType.Load, ["Memory Used", "Memory"]);
  // For network, pick the most active non-virtual adapter
  if (!settings.sensors.downRate.customReadingId || !settings.sensors.upRate.customReadingId) {
    const netHwIds = new Set(
      hardwares.filter((h) => h.hardwareType === HardwareType.Network).map((h) => h.identifier)
    );
    const netSensors = sensors.filter((s) => netHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Throughput);
    const nicTotals: Record<string, number> = {};
    for (const s of netSensors) nicTotals[s.hardwareIdentifier] = (nicTotals[s.hardwareIdentifier] ?? 0) + s.value;
    const sortedNics = Object.entries(nicTotals).sort((a, b) => {
      const nameA = (hardwares.find((h) => h.identifier === a[0])?.name ?? "").toLowerCase();
      const nameB = (hardwares.find((h) => h.identifier === b[0])?.name ?? "").toLowerCase();
      const virtualA = nameA.includes("bluetooth") || nameA.includes("local area") || nameA.includes("loopback");
      const virtualB = nameB.includes("bluetooth") || nameB.includes("local area") || nameB.includes("loopback");
      if (virtualA !== virtualB) return virtualA ? 1 : -1;
      return b[1] - a[1];
    });
    if (sortedNics.length > 0) {
      const bestNicId = sortedNics[0][0];
      const nicSensors = netSensors.filter((s) => s.hardwareIdentifier === bestNicId);
      if (!settings.sensors.downRate.customReadingId) {
        const s = nicSensors.find((s) => s.name.toLowerCase().includes("download") || s.name.toLowerCase().includes("down"));
        if (s) { patch["downRate"] = { ...settings.sensors.downRate, customReadingId: s.identifier }; changed = true; }
      }
      if (!settings.sensors.upRate.customReadingId) {
        const s = nicSensors.find((s) => s.name.toLowerCase().includes("upload") || s.name.toLowerCase().includes("up"));
        if (s) { patch["upRate"] = { ...settings.sensors.upRate, customReadingId: s.identifier }; changed = true; }
      }
    }
  }

  // Frametime — from PresentMon (hardware identifier contains "presentmon")
  const frametimeSensor = sensors.find(
    (s) =>
      !settings.sensors.frametime.customReadingId &&
      (s.name.toLowerCase().includes("frametime") ||
        s.identifier.toLowerCase().includes("frametime"))
  );
  if (frametimeSensor) {
    patch["frametime"] = {
      ...settings.sensors.frametime,
      customReadingId: frametimeSensor.identifier,
    };
    changed = true;
  }

  // Framerate
  const framerateSensor = sensors.find(
    (s) =>
      !settings.sensors.framerate.customReadingId &&
      (s.name.toLowerCase().includes("display") ||
        s.name.toLowerCase().includes("fps") ||
        s.identifier.toLowerCase().includes("displayed") ||
        s.identifier.toLowerCase().includes("framerate"))
  );
  if (framerateSensor) {
    patch["framerate"] = {
      ...settings.sensors.framerate,
      customReadingId: framerateSensor.identifier,
    };
    changed = true;
  }

  return changed ? patch : null;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(settings: OverlaySettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => tauri.saveSettings(settings), 300);
}

interface SettingsStore {
  // State
  settings: OverlaySettings;
  preferences: AppPreferences;
  sensorData: HardwareMonitorData | null;
  presentMonApps: string[];
  pipeStatus: PipeStatus;
  overlayVisible: boolean;
  appVersion: string;

  // Settings actions
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<OverlaySettings>) => void;
  updateSensor: (key: SensorKey, patch: Partial<SensorConfig>) => void;
  updateGraphSensor: (
    key: SensorKey,
    patch: Partial<GraphSensorConfig>
  ) => void;
  updateBoundary: (key: SensorKey, boundaries: Boundaries) => void;
  clearSettings: () => Promise<void>;

  // Preferences
  loadPreferences: () => Promise<void>;
  updatePreferences: (patch: Partial<AppPreferences>) => void;

  // Sensor data
  setSensorData: (data: HardwareMonitorData) => void;
  setPresentMonApps: (apps: string[]) => void;
  setPipeStatus: (status: PipeStatus) => void;

  // Overlay
  toggleOverlay: () => void;
  setOverlayVisible: (visible: boolean) => void;

  // System
  loadAppVersion: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  preferences: { adminConsent: false, startMinimized: false },
  sensorData: null,
  presentMonApps: [],
  pipeStatus: { connected: false },
  overlayVisible: false,
  appVersion: "2.0.0",

  loadSettings: async () => {
    try {
      const saved = await tauri.getSettings();
      const settings: OverlaySettings = saved
        ? {
            ...DEFAULT_SETTINGS,
            ...saved,
            sensors: { ...DEFAULT_SETTINGS.sensors, ...(saved.sensors ?? {}) },
          }
        : { ...DEFAULT_SETTINGS };
      // No UI exposes isPositionLocked, so a stale `true` from an older
      // install would freeze the HUD with no way to recover — both the
      // React drag handlers and the cursor:grab style gate on !locked.
      if (settings.useCustomPosition && settings.isPositionLocked) {
        settings.isPositionLocked = false;
      }
      set({ settings });
      tauri.setOverlayClickThrough(!settings.useCustomPosition && settings.isPositionLocked);
    } catch {
      tauri.setOverlayClickThrough(false);
    }
  },

  updateSettings: (patch) => {
    const newSettings = { ...get().settings, ...patch };
    // Mirror the loadSettings guard — when custom-position is on, never
    // carry a stale lock that would silently re-disable drag.
    if (newSettings.useCustomPosition && newSettings.isPositionLocked) {
      newSettings.isPositionLocked = false;
    }
    set({ settings: newSettings });
    debouncedSave(newSettings);

    if (patch.isPositionLocked !== undefined || patch.useCustomPosition !== undefined) {
      tauri.setOverlayClickThrough(!newSettings.useCustomPosition && newSettings.isPositionLocked);
    }
    if (patch.opacity !== undefined) {
      tauri.setOverlayOpacity(patch.opacity);
    }
    if (patch.pollingRate !== undefined) {
      tauri.setPollingRate(patch.pollingRate);
    }
  },

  updateSensor: (key, patch) => {
    const settings = get().settings;
    const current = settings.sensors[key];
    const updated = { ...current, ...patch };
    const newSensors = { ...settings.sensors, [key]: updated };
    const newSettings = { ...settings, sensors: newSensors };
    set({ settings: newSettings });
    debouncedSave(newSettings);
  },

  updateGraphSensor: (key, patch) => {
    const settings = get().settings;
    const current = settings.sensors[key] as GraphSensorConfig;
    const updated = { ...current, ...patch };
    const newSensors = { ...settings.sensors, [key]: updated };
    const newSettings = { ...settings, sensors: newSensors };
    set({ settings: newSettings });
    debouncedSave(newSettings);
  },

  updateBoundary: (key, boundaries) => {
    const settings = get().settings;
    const current = settings.sensors[key] as GraphSensorConfig;
    const updated = { ...current, boundaries };
    const newSensors = { ...settings.sensors, [key]: updated };
    const newSettings = { ...settings, sensors: newSensors };
    set({ settings: newSettings });
    debouncedSave(newSettings);
  },

  clearSettings: async () => {
    await tauri.clearSettings();
    set({ settings: { ...DEFAULT_SETTINGS } });
  },

  loadPreferences: async () => {
    try {
      const preferences = await tauri.getPreferences();
      if (preferences) set({ preferences });
    } catch {
      // Use defaults
    }
  },

  updatePreferences: (patch) => {
    const newPrefs = { ...get().preferences, ...patch };
    set({ preferences: newPrefs });
    tauri.savePreferences(newPrefs);
  },

  setSensorData: (data) => {
    const state = get();
    const wasNull = state.sensorData === null;
    set({ sensorData: data });
    // Auto-select sensor IDs the first time data arrives (if any are still empty)
    const patch = autoSelectSensors(data, state.settings);
    if (patch) {
      const newSensors = { ...state.settings.sensors, ...patch };
      const newSettings = { ...state.settings, sensors: newSensors };
      set({ settings: newSettings });
      debouncedSave(newSettings);
    }
    // Auto-show overlay on first data arrival
    if (wasNull && !state.overlayVisible) {
      set({ overlayVisible: true });
      tauri.setOverlayVisible(true);
    }
  },
  setPresentMonApps: (apps) => set({ presentMonApps: apps }),
  setPipeStatus: (status) => set({ pipeStatus: status }),

  toggleOverlay: () => {
    const visible = !get().overlayVisible;
    set({ overlayVisible: visible });
    tauri.setOverlayVisible(visible);
  },

  setOverlayVisible: (visible) => {
    set({ overlayVisible: visible });
    tauri.setOverlayVisible(visible);
  },

  loadAppVersion: async () => {
    try {
      const version = await tauri.getAppVersion();
      if (version) set({ appVersion: version });
    } catch {
      // Keep default
    }
  },
}));

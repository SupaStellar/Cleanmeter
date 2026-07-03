import { create } from "zustand";
import type {
  OverlaySettings,
  HardwareMonitorData,
  PipeStatus,
  SensorKey,
  FramerateSensorConfig,
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

  const tryFill = <K extends SensorKey>(
    key: K,
    hwTypes: HardwareType[],
    sType: SensorType,
    prefer: string[]
  ) => {
    const current = settings.sensors[key];
    if (!current.customReadingId) {
      const id = findBest(sensors, hardwares, hwTypes, sType, prefer);
      if (id) {
        patch[key] = { ...current, customReadingId: id } as OverlaySettings["sensors"][K];
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

  // Framerate — prefer the PresentMon "presented" sensor. It's derived from
  // present-to-present frametime, which PresentMon reports on every config
  // (including AMD APUs / iGPUs). The "displayed" sensor needs display-timing
  // telemetry that some GPUs don't expose, so it reads 0 there (and older
  // builds surfaced -1) — see the displayed→presented heal in loadSettings.
  if (!settings.sensors.framerate.customReadingId) {
    const framerateSensor =
      sensors.find((s) => s.identifier.toLowerCase().includes("presented")) ??
      sensors.find(
        (s) =>
          s.name.toLowerCase().includes("fps") ||
          s.name.toLowerCase().includes("framerate") ||
          s.identifier.toLowerCase().includes("displayed") ||
          s.identifier.toLowerCase().includes("framerate")
      );
    if (framerateSensor) {
      patch["framerate"] = {
        ...settings.sensors.framerate,
        customReadingId: framerateSensor.identifier,
      };
      changed = true;
    }
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
  // Generic over SensorKey so framerate's extra targetAppName field is
  // accepted, while non-framerate keys still see only the base SensorConfig
  // shape.
  updateSensor: <K extends SensorKey>(
    key: K,
    patch: Partial<OverlaySettings["sensors"][K]>
  ) => void;
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

// Seed isDarkTheme from the <html data-theme> the pre-hydration script in
// index.html set from the persisted localStorage mirror. This makes the first
// React render (and App's data-theme effect) match what the splash already
// painted, so the theme doesn't flip when the async loadSettings() resolves.
const prehydratedDark =
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark";

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, isDarkTheme: prehydratedDark },
  preferences: { adminConsent: false, startMinimized: false },
  sensorData: null,
  presentMonApps: [],
  pipeStatus: { connected: false },
  overlayVisible: false,
  // Empty until loadAppVersion() resolves the real version — better a brief
  // blank than a misleading hardcoded number.
  appVersion: "",

  loadSettings: async () => {
    try {
      const saved = await tauri.getSettings();
      // Per-sensor merge so newly-added fields (e.g. boundaries on power
      // configs) hydrate onto older saves that pre-date them.
      const mergedSensors = { ...DEFAULT_SETTINGS.sensors };
      const savedSensors = (saved?.sensors ?? {}) as Partial<OverlaySettings["sensors"]>;
      for (const key of Object.keys(DEFAULT_SETTINGS.sensors) as (keyof OverlaySettings["sensors"])[]) {
        mergedSensors[key] = {
          ...DEFAULT_SETTINGS.sensors[key],
          ...(savedSensors[key] ?? {}),
        } as OverlaySettings["sensors"][typeof key];
      }
      const settings: OverlaySettings = saved
        ? {
            ...DEFAULT_SETTINGS,
            ...saved,
            sensors: mergedSensors,
          }
        : { ...DEFAULT_SETTINGS };
      // The previously-rendered SettingsTab only wrote isDarkTheme, never
      // themeMode — so old save files have no themeMode key and would
      // resolve to DEFAULT_SETTINGS.themeMode ("light") after merge,
      // showing the Light card highlighted while the app is actually dark.
      // Seed themeMode from isDarkTheme on first load.
      if (!saved?.themeMode) {
        settings.themeMode = settings.isDarkTheme ? "dark" : "light";
      }
      // No UI exposes isPositionLocked, so a stale `true` from an older
      // install would freeze the HUD with no way to recover — both the
      // React drag handlers and the cursor:grab style gate on !locked.
      if (settings.useCustomPosition && settings.isPositionLocked) {
        settings.isPositionLocked = false;
      }
      // Migrate older builds that wrote the chosen PresentMon app into
      // framerate.customReadingId. customReadingId is now strictly a sensor
      // identifier (e.g. "/presentmon/displayed"); the chosen app lives in
      // targetAppName. Sensor identifiers always start with "/", app names
      // don't — so anything not starting with "/" is a stale app name.
      const fr = settings.sensors.framerate;
      if (fr.customReadingId && !fr.customReadingId.startsWith("/")) {
        settings.sensors = {
          ...settings.sensors,
          framerate: {
            ...fr,
            targetAppName: fr.targetAppName || fr.customReadingId,
            customReadingId: "",
          },
        };
      }
      // FPS source heal: older builds auto-selected the PresentMon "displayed"
      // sensor, which reads 0 on GPUs that don't expose display-timing telemetry
      // (the same machines where the old reader surfaced -1). The "presented"
      // sensor is frametime-derived and populates everywhere, so repoint
      // existing installs at it. Only the auto-managed presentmon identifier is
      // rewritten — a user's own custom pick is left untouched.
      if (settings.sensors.framerate.customReadingId === "/presentmon/displayed") {
        settings.sensors = {
          ...settings.sensors,
          framerate: {
            ...settings.sensors.framerate,
            customReadingId: "/presentmon/presented",
          },
        };
        // Persist immediately so a fully-configured install (where
        // autoSelectSensors produces no patch) doesn't re-run this heal
        // on every subsequent startup.
        tauri.saveSettings(settings);
      }
      // pillOpacity has no UI control, so a saved 0.24 can only be PR#8's
      // (now reverted) default leaking in from a prior run. Heal it back to
      // the restored 0.3 so existing installs match the reverted look.
      if (settings.pillOpacity === 0.24) {
        settings.pillOpacity = 0.3;
      }
      set({ settings });
      tauri.setOverlayClickThrough(!settings.useCustomPosition && settings.isPositionLocked);
      // Push the persisted target-app to the C# poller so it starts in sync.
      // Empty string means Auto (foreground-window detection on the C# side).
      tauri.selectPresentMonApp(settings.sensors.framerate.targetAppName || "Auto");
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

    // The framerate target-app filter has to be pushed to the C# poller
    // immediately — saving to disk alone never reached it, which is why
    // manual selection had no effect on FPS. Empty maps to "Auto"
    // (foreground-window detection on the C# side).
    if (key === "framerate") {
      const framerate = patch as Partial<FramerateSensorConfig>;
      if (framerate.targetAppName !== undefined) {
        tauri.selectPresentMonApp(framerate.targetAppName || "Auto");
      }
    }
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
  setPipeStatus: (status) => {
    const wasConnected = get().pipeStatus.connected;
    set({ pipeStatus: status });
    // After a (re)connect, resync the target-app filter — the C# poller
    // restarts with `_currentSelectedApp = NONE`, so without this it would
    // count every app's frames again until the next dropdown change.
    if (status.connected && !wasConnected) {
      const target = get().settings.sensors.framerate.targetAppName;
      tauri.selectPresentMonApp(target || "Auto");
    }
  },

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

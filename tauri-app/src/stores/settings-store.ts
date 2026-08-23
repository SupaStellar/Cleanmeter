import { create } from "zustand";
import type {
  OverlaySettings,
  HardwareMonitorData,
  PipeStatus,
  SidecarStatus,
  SensorKey,
  FramerateSensorConfig,
  GraphSensorConfig,
  Boundaries,
  AppPreferences,
  Sensor,
  Hardware,
} from "@/lib/types";
import { DEFAULT_SETTINGS, HardwareType, SensorType } from "@/lib/types";
import {
  listGpus,
  nextGpuSilence,
  NO_GPU_SILENCE,
  resolveSelectedGpu,
  sensorsOnGpu,
  shouldRepickSensor,
  type GpuSilence,
} from "@/lib/gpu";
import { sensorReadingIds, sensorReadingPatch } from "@/lib/sensor-readings";
import * as tauri from "@/lib/tauri";

const GPU_SENSOR_KEYS = [
  "gpuUsage",
  "gpuTemp",
  "gpuConsumption",
  "vramUsage",
  "totalVramUsed",
] as const satisfies readonly SensorKey[];

/**
 * Best sensor of a given type out of an already-narrowed list, by keyword
 * preference, falling back to the first of that type.
 */
function bestOf(candidates: Sensor[], sensorType: SensorType, prefer: string[]): string {
  const ofType = candidates.filter((s) => s.sensorType === sensorType);
  if (ofType.length === 0) return "";
  for (const keyword of prefer) {
    const match = ofType.find((s) =>
      s.name.toLowerCase().includes(keyword.toLowerCase())
    );
    if (match) return match.identifier;
  }
  return ofType[0].identifier;
}

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
  return bestOf(
    sensors.filter((s) => hwIds.has(s.hardwareIdentifier)),
    sensorType,
    prefer
  );
}

/**
 * What autoSelectSensors decided. `selectedGpuId` is separate from `sensors`
 * because it lives at the top level of the settings shape, not under it.
 */
interface AutoSelection {
  sensors: Partial<OverlaySettings["sensors"]>;
  selectedGpuId: string;
}

function autoSelectSensors(
  data: HardwareMonitorData,
  settings: OverlaySettings
): AutoSelection | null {
  const { sensors, hardwares } = data;
  const sensorsById = new Map(sensors.map((sensor) => [sensor.identifier, sensor]));
  const patch: Partial<OverlaySettings["sensors"]> = {};
  let changed = false;

  const cpuHw = [HardwareType.Cpu];

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

  // Every GPU reading comes from one GPU, so the GPU is resolved first and the
  // rows are then filled from its sensors alone.
  const gpus = listGpus(hardwares);
  const selectedGpuId = resolveSelectedGpu(
    settings.selectedGpuId,
    settings.sensors.gpuUsage.customReadingId,
    gpus,
    sensors
  );
  const gpuSensors = sensorsOnGpu(sensors, selectedGpuId);

  if (selectedGpuId !== settings.selectedGpuId) changed = true;

  /**
   * Fill a GPU row, and re-point it when it names a sensor on another GPU.
   *
   * Unlike tryFill, an existing choice is not automatically kept, which is
   * what repairs a configuration written before the GPU was pinned. See
   * shouldRepickSensor for when a choice is left alone.
   *
   * Clearing rather than keeping is deliberate when the selected GPU has no
   * sensors at all, a card powered down or whose vendor SDK is not answering:
   * bestOf returns "" and the row reads 0. Showing 0 for the GPU you chose is
   * honest; quietly showing the other GPU's numbers is the bug this whole
   * change exists to remove.
   */
  const fillOnGpu = <K extends SensorKey>(
    key: K,
    sType: SensorType,
    prefer: string[]
  ) => {
    const current = settings.sensors[key];
    const id = shouldRepickSensor(current.customReadingId, selectedGpuId, sensors)
      ? bestOf(gpuSensors, sType, prefer)
      : current.customReadingId;
    // A saved supplemental reading can be absent during GPU warm-up, so keep
    // unknown identifiers. Once an identifier resolves to another GPU, remove
    // it rather than allowing one metric to mix sources.
    const additionalReadingIds = current.additionalReadingIds.filter((readingId) => {
      const sensor = sensorsById.get(readingId);
      return sensor === undefined || sensor.hardwareIdentifier === selectedGpuId;
    });
    const readingPatch = sensorReadingPatch([id, ...additionalReadingIds]);
    const unchanged =
      readingPatch.customReadingId === current.customReadingId &&
      readingPatch.additionalReadingIds.length === current.additionalReadingIds.length &&
      readingPatch.additionalReadingIds.every(
        (readingId, index) => readingId === current.additionalReadingIds[index],
      );
    if (unchanged) return;

    patch[key] = { ...current, ...readingPatch } as OverlaySettings["sensors"][K];
    changed = true;
  };

  tryFill("cpuUsage", cpuHw, SensorType.Load, ["CPU Total", "CPU Package", "CPU"]);
  tryFill("cpuTemp", cpuHw, SensorType.Temperature, ["CPU Package", "CPU Core", "CPU"]);
  tryFill("cpuConsumption", cpuHw, SensorType.Power, ["CPU Package", "CPU"]);
  fillOnGpu("gpuUsage", SensorType.Load, ["GPU Core", "D3D 3D", "GPU"]);
  fillOnGpu("gpuTemp", SensorType.Temperature, ["GPU Core", "GPU"]);
  fillOnGpu("vramUsage", SensorType.Load, ["GPU Memory", "Memory"]);
  fillOnGpu("totalVramUsed", SensorType.SmallData, ["GPU Memory Used", "Memory Used", "VRAM"]);
  fillOnGpu("gpuConsumption", SensorType.Power, ["GPU Package", "GPU Power", "GPU"]);
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

  return changed ? { sensors: patch, selectedGpuId } : null;
}

/** Set once the sidecar-status event channel has delivered anything. See
 *  loadSidecarStatus, which is a one-shot catch-up read and must not overwrite
 *  the live channel. Module scope rather than store state: it orders two
 *  writers, it is not something the UI renders. */
let sawSidecarEvent = false;

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
  sidecarStatus: SidecarStatus;
  overlayVisible: boolean;
  appVersion: string;
  /**
   * How long the selected GPU has been reporting nothing. Read `.settled`;
   * a single snapshot cannot tell a parked GPU from one still warming up.
   */
  gpuSilence: GpuSilence;

  // Settings actions
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<OverlaySettings>) => void;
  /**
   * Pin every GPU reading to one GPU. Not updateSettings({ selectedGpuId }),
   * because changing the GPU has to re-point every GPU sensor row onto it in
   * the same update, or they keep naming sensors on the old GPU.
   */
  selectGpu: (gpuId: string) => void;
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
  setSidecarStatus: (status: SidecarStatus) => void;
  loadSidecarStatus: () => Promise<void>;

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
  // Nothing has gone wrong until the supervisor says so, so a launch reads as
  // "still starting" rather than as a failure.
  sidecarStatus: { exits: 0, spawnError: null },
  gpuSilence: NO_GPU_SILENCE,
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
        const merged = {
          ...DEFAULT_SETTINGS.sensors[key],
          ...(savedSensors[key] ?? {}),
        } as OverlaySettings["sensors"][typeof key];
        // Older saves have only customReadingId. Normalizing here also removes
        // duplicate IDs before the settings reach either window.
        mergedSensors[key] = {
          ...merged,
          ...sensorReadingPatch(sensorReadingIds(merged)),
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
      // Font sizes are now capped (Stats ≤24, Label ≤18); clamp any larger
      // value saved by an older build so the overlay never renders an
      // unsupported size the picker can no longer represent.
      if (settings.fontSizeValue > 24) settings.fontSizeValue = 24;
      if (settings.fontSizeLabel > 18) settings.fontSizeLabel = 18;
      set({ settings });
      // Push the persisted target-app to the C# poller so it starts in sync.
      // Empty string means Auto (foreground-window detection on the C# side).
      tauri.selectPresentMonApp(settings.sensors.framerate.targetAppName || "Auto");
    } catch (err) {
      // The store keeps DEFAULT_SETTINGS, which is a usable overlay — but say so
      // rather than swallowing it, otherwise a settings file that fails to parse
      // looks identical to a fresh install.
      console.error("loadSettings failed:", err);
    }
  },

  selectGpu: (gpuId) => {
    const state = get();
    let sensorsForGpu = state.settings.sensors;
    if (gpuId !== state.settings.selectedGpuId) {
      sensorsForGpu = { ...state.settings.sensors };
      for (const key of GPU_SENSOR_KEYS) {
        sensorsForGpu[key] = {
          ...sensorsForGpu[key],
          // Supplemental values are tied to the old source. The auto-selector
          // below chooses a new primary, and the user can add readings exposed
          // by the newly selected GPU without stale cross-GPU IDs lingering.
          additionalReadingIds: [],
        } as OverlaySettings["sensors"][typeof key];
      }
    }
    const withGpu = { ...state.settings, selectedGpuId: gpuId, sensors: sensorsForGpu };

    // Re-point every GPU row in the same tick rather than waiting for the
    // next poll to do it. Same code path either way, so the two cannot drift;
    // doing it here only means the sensor pickers never briefly read "Select"
    // while showing sensors from a GPU that is no longer chosen.
    const selection = state.sensorData
      ? autoSelectSensors(state.sensorData, withGpu)
      : null;

    const newSettings = selection
      ? {
          ...withGpu,
          selectedGpuId: selection.selectedGpuId,
          sensors: { ...withGpu.sensors, ...selection.sensors },
        }
      : withGpu;

    set({ settings: newSettings });
    debouncedSave(newSettings);

    // Re-time the silence clock against the GPU that was just chosen. Without
    // this the old GPU's verdict survives until the next poll, so switching
    // away from a parked GPU leaves its "reports 0" notice sitting under a GPU
    // that is reading fine for up to a polling interval.
    set({
      gpuSilence: nextGpuSilence(
        NO_GPU_SILENCE,
        newSettings.selectedGpuId,
        state.sensorData?.sensors ?? [],
        Date.now(),
      ),
    });
  },
  updateSettings: (patch) => {
    const newSettings = { ...get().settings, ...patch };
    set({ settings: newSettings });
    debouncedSave(newSettings);

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
    // Fill in any sensor still unset, and re-point the GPU rows if they name
    // a sensor on a GPU other than the selected one.
    const selection = autoSelectSensors(data, state.settings);
    if (selection) {
      const newSensors = { ...state.settings.sensors, ...selection.sensors };
      const newSettings = {
        ...state.settings,
        selectedGpuId: selection.selectedGpuId,
        sensors: newSensors,
      };
      set({ settings: newSettings });
      debouncedSave(newSettings);
    }
    // Advance the "this GPU is reporting nothing" clock. Here rather than in a
    // component timer because this already runs once per poll, so it needs no
    // timer of its own and stays a pure function of the previous state, the
    // snapshot, and the time.
    set({
      gpuSilence: nextGpuSilence(
        state.gpuSilence,
        selection?.selectedGpuId ?? state.settings.selectedGpuId,
        data.sensors,
        Date.now(),
      ),
    });
    // Auto-show overlay on first data arrival
    if (wasNull && !state.overlayVisible) {
      set({ overlayVisible: true });
      tauri.setOverlayVisible(true);
    }
  },
  setPresentMonApps: (apps) => set({ presentMonApps: apps }),
  setSidecarStatus: (status) => {
    sawSidecarEvent = true;
    set({ sidecarStatus: status });
  },
  loadSidecarStatus: async () => {
    try {
      // Undefined in the browser preview, where there is no Tauri runtime and no
      // sidecar to have an opinion about.
      const status = await tauri.getSidecarStatus();
      // The read races the event channel: one arriving while the invoke was in
      // flight would otherwise be reverted to this older snapshot, hiding a real
      // failure or pinning a spawn error that a successful respawn already
      // cleared. Comparing `exits` is not enough, since both of those flip
      // `spawnError` without changing the count. The event is the live channel,
      // so once it has delivered anything this read has nothing left to add.
      if (!status || sawSidecarEvent) return;
      set({ sidecarStatus: status });
    } catch (err) {
      console.error("Failed to load sidecar status:", err);
    }
  },
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

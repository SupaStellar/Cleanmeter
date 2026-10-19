import { useSettingsStore } from "@/stores/settings-store";
import type { OverlaySettings, SensorKey } from "./types";
import { playSound } from "./sound-effects";

// Live UI entry points. Hydration, telemetry, hotkeys and overlay sync continue
// using the silent store actions. Continuous inputs are deliberately excluded.
const selectionKeys: (keyof OverlaySettings)[] = [
  "positionIndex", "isHorizontal", "graphType", "progressType",
  "fontSizeLabel", "fontSizeValue", "labelFontWeight", "fontWeight",
  "temperatureUnit", "pollingRate", "themeMode", "selectedDisplayIndex",
  "pixelShiftDistance", "pixelShiftInterval",
];
const toggleKeys: (keyof OverlaySettings)[] = ["pixelShift", "useCustomPosition"];

export const settingsActions = {
  updateSettings(patch: Partial<OverlaySettings>) {
    const before = useSettingsStore.getState().settings;
    useSettingsStore.getState().updateSettings(patch);
    const toggle = toggleKeys.find((key) => key in patch && patch[key] !== before[key]);
    if (toggle) {
      playSound("toggle", patch[toggle] ? "forward" : "back");
    } else if (patch.progressType !== undefined &&
        (patch.progressType === "none") !== (before.progressType === "none")) {
      playSound("toggle", patch.progressType === "none" ? "back" : "forward");
    } else if (selectionKeys.some((key) => key in patch && patch[key] !== before[key])) {
      playSound("select");
    }
  },
  updateSensor<K extends SensorKey>(key: K, patch: Partial<OverlaySettings["sensors"][K]>) {
    const before = useSettingsStore.getState().settings.sensors[key];
    useSettingsStore.getState().updateSensor(key, patch);
    if (patch.isEnabled !== undefined && patch.isEnabled !== before.isEnabled) {
      playSound("press");
    } else if (Object.entries(patch).some(([field, value]) =>
      ["customReadingId", "targetAppName"].includes(field) &&
      value !== (before as unknown as Record<string, unknown>)[field])) {
      playSound("select");
    }
  },
  selectGpu(gpuId: string) {
    const before = useSettingsStore.getState().settings.selectedGpuId;
    useSettingsStore.getState().selectGpu(gpuId);
    if (gpuId !== before) playSound("select");
  },
};

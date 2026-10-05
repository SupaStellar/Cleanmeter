import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/types";
import * as tauri from "@/lib/tauri";

vi.mock("@/lib/tauri", () => ({
  saveSettings: vi.fn().mockResolvedValue(undefined),
  savePreferences: vi.fn().mockResolvedValue(undefined),
  setAutoStart: vi.fn().mockResolvedValue(undefined),
  setPollingRate: vi.fn().mockResolvedValue(undefined),
  setOverlayOpacity: vi.fn().mockResolvedValue(undefined),
  selectPresentMonApp: vi.fn().mockResolvedValue(undefined),
}));

const { useSettingsStore } = await import("./settings-store");

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useSettingsStore.setState({
    settings: structuredClone(DEFAULT_SETTINGS),
    preferences: { adminConsent: true, startMinimized: true },
    sensorData: null,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("reset all settings", () => {
  it("replaces custom settings, cancels pending edits and applies persisted and runtime defaults", async () => {
    const store = useSettingsStore.getState();
    store.updateSettings({ isDarkTheme: true, themeMode: "dark", pollingRate: 100, positionX: 500 });
    store.updateSensor("framerate", { isEnabled: false, targetAppName: "game.exe" });
    store.updateBoundary("cpuTemp", { low: 1, medium: 2, high: 3 });
    vi.clearAllMocks();

    await store.clearSettings();
    await vi.runAllTimersAsync();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().settings.sensors).not.toBe(DEFAULT_SETTINGS.sensors);
    expect(useSettingsStore.getState().preferences).toEqual({ adminConsent: false, startMinimized: false });
    expect(tauri.saveSettings).toHaveBeenCalledExactlyOnceWith(DEFAULT_SETTINGS);
    expect(tauri.savePreferences).toHaveBeenCalledExactlyOnceWith({ adminConsent: false, startMinimized: false });
    expect(tauri.setAutoStart).toHaveBeenCalledExactlyOnceWith(false);
    expect(tauri.setPollingRate).toHaveBeenCalledExactlyOnceWith(DEFAULT_SETTINGS.pollingRate);
    expect(tauri.setOverlayOpacity).toHaveBeenCalledExactlyOnceWith(DEFAULT_SETTINGS.opacity);
    expect(tauri.selectPresentMonApp).toHaveBeenCalledExactlyOnceWith("Auto");
  });

  it("reports a native failure so the Help page cannot announce a successful reset", async () => {
    vi.mocked(tauri.setAutoStart).mockRejectedValueOnce(new Error("Startup task unavailable"));
    await expect(useSettingsStore.getState().clearSettings()).rejects.toThrow("Startup task unavailable");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/types";
import * as tauri from "@/lib/tauri";

vi.mock("@/lib/tauri", () => ({
  saveSettings: vi.fn().mockResolvedValue(undefined),
  configureLaunchHotkey: vi.fn().mockResolvedValue(undefined),
  savePreferences: vi.fn().mockResolvedValue(undefined),
  setAutoStart: vi.fn().mockResolvedValue(undefined),
  setPollingRate: vi.fn().mockResolvedValue(undefined),
  setOverlayOpacity: vi.fn().mockResolvedValue(undefined),
  selectPresentMonApp: vi.fn().mockResolvedValue(undefined),
}));

const { useSettingsStore, flushSettingsSave } = await import("./settings-store");

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
  it("flushes pending edits once before configuring a launch shortcut", async () => {
    useSettingsStore.getState().updateSettings({ overlayShortcut: "Ctrl+Alt+Space" });
    await flushSettingsSave();
    await vi.runAllTimersAsync();
    expect(tauri.saveSettings).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tauri.saveSettings).mock.calls[0][0].overlayShortcut).toBe("Ctrl+Alt+Space");
  });
  it("removes the Windows launch shortcut before saving defaults", async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, launchWithHotkey: true } });
    await useSettingsStore.getState().clearSettings();
    expect(tauri.configureLaunchHotkey).toHaveBeenCalledExactlyOnceWith(false, DEFAULT_SETTINGS.overlayShortcut);
    expect(vi.mocked(tauri.configureLaunchHotkey).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(tauri.saveSettings).mock.invocationCallOrder[0]);
    expect(useSettingsStore.getState().settings.launchWithHotkey).toBe(false);
  });
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

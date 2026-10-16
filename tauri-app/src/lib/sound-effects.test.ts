import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./types";
import { play, setEnabled } from "cuelume";
import { play as playLegacy, setEnabled as enableLegacy } from "cuelume-legacy";
import * as tauri from "./tauri";

vi.mock("cuelume", () => ({ play: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn(), unlock: vi.fn() }));
vi.mock("cuelume-legacy", () => ({ play: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() }));
vi.mock("./tauri", () => ({
  saveSettings: vi.fn(), savePreferences: vi.fn(), getPreferences: vi.fn(),
  setPollingRate: vi.fn(), setOverlayOpacity: vi.fn(), selectPresentMonApp: vi.fn(),
}));
const { useSettingsStore } = await import("@/stores/settings-store");
const { playSound, beginSoundAction } = await import("./sound-effects");
const { settingsActions } = await import("./settings-actions");

beforeEach(() => {
  useSettingsStore.setState({ preferencesLoaded: false });
  useSettingsStore.setState({
    preferencesLoaded: true,
    preferences: { adminConsent: false, startMinimized: false, soundEffects: true },
    settings: structuredClone(DEFAULT_SETTINGS),
  });
  vi.clearAllMocks();
});

describe("sound policy", () => {
  it("is silent before preferences load and while muted, including active voice cancellation", () => {
    useSettingsStore.setState({ preferencesLoaded: false });
    playSound("toggle");
    expect(playLegacy).not.toHaveBeenCalled();
    useSettingsStore.setState({ preferencesLoaded: true });
    playSound("toggle");
    expect(playLegacy).toHaveBeenCalledTimes(1);
    useSettingsStore.getState().updatePreferences({ soundEffects: false });
    expect(setEnabled).toHaveBeenLastCalledWith(false);
    playSound("success");
    playSound("press");
    expect(enableLegacy).toHaveBeenLastCalledWith(false);
    expect(play).not.toHaveBeenCalled();
    expect(playLegacy).toHaveBeenCalledTimes(1);
  });

  it("coalesces a section's multiple sensor updates into one cue", () => {
    playSound("toggle"); // SectionCard emits once before updating its sensor group.
    for (const key of ["cpuUsage", "cpuTemp", "cpuClock", "cpuConsumption"] as const) {
      settingsActions.updateSensor(key, { isEnabled: !DEFAULT_SETTINGS.sensors[key].isEnabled });
    }
    expect(playLegacy).toHaveBeenCalledTimes(1);
    expect(playLegacy).toHaveBeenCalledWith("toggle", expect.anything());
  });

  it("plays all ten rapid toggle events without a time-based cooldown", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(100);
    try {
      for (let i = 0; i < 10; i++) {
        settingsActions.updateSettings({ pixelShift: !useSettingsStore.getState().settings.pixelShift });
        // Real input events are separated by the browser's microtask checkpoint.
        await Promise.resolve();
      }
      expect(playLegacy).toHaveBeenCalledTimes(10);
      expect(vi.mocked(playLegacy).mock.calls.every(([sound]) => sound === "toggle")).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });

  it("keeps unchanged choices, sliders, thresholds and silent store updates quiet", () => {
    settingsActions.updateSettings({ positionIndex: DEFAULT_SETTINGS.positionIndex });
    settingsActions.updateSettings({ opacity: 0.4 });
    useSettingsStore.getState().updateBoundary("cpuTemp", { low: 40, medium: 60, high: 80 });
    useSettingsStore.getState().updateSensor("cpuUsage", { isEnabled: false });
    expect(play).not.toHaveBeenCalled();
  });

  it("plays current select and original Legacy toggle", () => {
    settingsActions.updateSettings({ positionIndex: DEFAULT_SETTINGS.positionIndex === 0 ? 1 : 0 });
    expect(play).toHaveBeenLastCalledWith("select", { direction: "forward" });
    useSettingsStore.getState().updatePreferences({ soundEffects: false });
    useSettingsStore.getState().updatePreferences({ soundEffects: true });
    useSettingsStore.getState().updateSettings({ pixelShift: true });
    settingsActions.updateSettings({ pixelShift: false });
    expect(playLegacy).toHaveBeenLastCalledWith("toggle", { volume: undefined });
  });

  it("uses original press for a sensor checkbox without changing other cues", async () => {
    settingsActions.updateSensor("cpuUsage", { isEnabled: !DEFAULT_SETTINGS.sensors.cpuUsage.isEnabled });
    expect(playLegacy).toHaveBeenLastCalledWith("press", { volume: undefined });
    expect(play).not.toHaveBeenCalled();
    await Promise.resolve();
    playSound("open", "forward", { volume: 0.5, emphasis: "subtle" });
    expect(play).toHaveBeenLastCalledWith("open", { direction: "forward", volume: 0.5, emphasis: "subtle" });
  });

  it("does not replay an async result after muting then re-enabling", () => {
    const finish = beginSoundAction();
    useSettingsStore.getState().updatePreferences({ soundEffects: false });
    useSettingsStore.getState().updatePreferences({ soundEffects: true });
    finish("success");
    expect(play).not.toHaveBeenCalled();
  });

  it("contains audio failures without blocking the setting change", () => {
    vi.mocked(play).mockImplementationOnce(() => { throw new Error("No audio device"); });
    expect(() => settingsActions.updateSettings({ positionIndex: 7 })).not.toThrow();
    expect(useSettingsStore.getState().settings.positionIndex).toBe(7);
  });

  it("loads saved mute, migrates old preferences and fails silent on read errors", async () => {
    vi.mocked(tauri.getPreferences).mockResolvedValueOnce({ adminConsent: true, startMinimized: true, soundEffects: false });
    await useSettingsStore.getState().loadPreferences();
    expect(useSettingsStore.getState().preferences.soundEffects).toBe(false);
    expect(setEnabled).toHaveBeenLastCalledWith(false);
    vi.mocked(tauri.getPreferences).mockResolvedValueOnce({ adminConsent: true, startMinimized: true } as Awaited<ReturnType<typeof tauri.getPreferences>>);
    await useSettingsStore.getState().loadPreferences();
    expect(useSettingsStore.getState().preferences).toEqual({ adminConsent: true, startMinimized: true, soundEffects: true });
    vi.mocked(tauri.getPreferences).mockRejectedValueOnce(new Error("disk"));
    await useSettingsStore.getState().loadPreferences();
    expect(useSettingsStore.getState().preferences.soundEffects).toBe(false);
  });
});

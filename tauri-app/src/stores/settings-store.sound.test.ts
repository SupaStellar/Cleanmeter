import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauri from "@/lib/tauri";
import { useToastStore } from "./toast-store";

vi.mock("@/lib/tauri", () => ({ savePreferences: vi.fn().mockResolvedValue(undefined), getPreferences: vi.fn() }));
const { useSettingsStore } = await import("./settings-store");

describe("sound preference persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ preferencesLoaded: true });
  });
  it("blocks preference writes after a failed read and recovers on retry", async () => {
    vi.mocked(tauri.getPreferences).mockRejectedValueOnce(new Error("read failed"));
    await useSettingsStore.getState().loadPreferences();
    expect(useSettingsStore.getState().preferencesLoaded).toBe(false);
    expect(useSettingsStore.getState().preferences.soundEffects).toBe(false);
    useSettingsStore.getState().updatePreferences({ startMinimized: true });
    await Promise.resolve();
    expect(tauri.savePreferences).not.toHaveBeenCalled();
    vi.mocked(tauri.getPreferences).mockResolvedValueOnce({ adminConsent: true, startMinimized: true, soundEffects: true });
    await useSettingsStore.getState().loadPreferences();
    useSettingsStore.getState().updatePreferences({ startMinimized: false });
    await vi.waitFor(() => expect(tauri.savePreferences).toHaveBeenCalledWith({ adminConsent: true, startMinimized: false, soundEffects: true }));
  });
  it("serializes rapid edits so the last mute value is the last saved value", async () => {
    let completeFirst!: () => void;
    vi.mocked(tauri.savePreferences).mockImplementationOnce(() => new Promise<void>((resolve) => { completeFirst = resolve; }));
    const update = useSettingsStore.getState().updatePreferences;
    update({ soundEffects: true });
    update({ soundEffects: false });
    expect(useSettingsStore.getState().preferences.soundEffects).toBe(false);
    await vi.waitFor(() => expect(tauri.savePreferences).toHaveBeenCalledTimes(1));
    completeFirst();
    await vi.waitFor(() => expect(tauri.savePreferences).toHaveBeenCalledTimes(2));
    expect(tauri.savePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ soundEffects: false }));
  });

  it("reports a save rejection, keeps current mute and lets later edits save", async () => {
    vi.mocked(tauri.savePreferences).mockRejectedValueOnce(new Error("native invoke failed"));
    useSettingsStore.getState().updatePreferences({ soundEffects: false });
    await vi.waitFor(() => expect(useToastStore.getState().message).toContain("Couldn't save preferences"));
    expect(useSettingsStore.getState().preferences.soundEffects).toBe(false);
    useSettingsStore.getState().updatePreferences({ startMinimized: true });
    await vi.waitFor(() => expect(tauri.savePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ soundEffects: false, startMinimized: true })));
  });
});

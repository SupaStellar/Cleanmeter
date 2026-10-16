import { describe, expect, it, vi } from "vitest";
import * as tauri from "@/lib/tauri";
import { useToastStore } from "./toast-store";

vi.mock("@/lib/tauri", () => ({ savePreferences: vi.fn().mockResolvedValue(undefined) }));
const { useSettingsStore } = await import("./settings-store");

describe("sound preference persistence", () => {
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

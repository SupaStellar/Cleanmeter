import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type OverlaySettings } from "@/lib/types";
import * as tauri from "@/lib/tauri";

vi.mock("@/lib/tauri", () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  setPollingRate: vi.fn(),
  setOverlayOpacity: vi.fn(),
  selectPresentMonApp: vi.fn(),
}));

const { useSettingsStore } = await import("./settings-store");

function load(saved: Partial<OverlaySettings>) {
  vi.mocked(tauri.getSettings).mockResolvedValue({ ...DEFAULT_SETTINGS, ...saved } as OverlaySettings);
  return useSettingsStore.getState().loadSettings();
}

describe("theme mode on load", () => {
  // The native side hands back an empty themeMode for files written before
  // the field existed (see default_theme_mode in types.rs).
  it("keeps a legacy dark choice instead of switching it to follow the system", async () => {
    await load({ themeMode: "" as OverlaySettings["themeMode"], isDarkTheme: true });
    const { themeMode, isDarkTheme } = useSettingsStore.getState().settings;
    expect(themeMode).toBe("dark");
    expect(isDarkTheme).toBe(true);
  });

  it("resolves system mode from the OS", async () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    try {
      await load({ themeMode: "system", isDarkTheme: false });
      expect(useSettingsStore.getState().settings.isDarkTheme).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

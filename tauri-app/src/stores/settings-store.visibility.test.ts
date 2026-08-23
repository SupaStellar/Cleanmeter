import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HardwareMonitorData, Sensor } from "@/lib/types";
import { DEFAULT_SETTINGS, SensorType } from "@/lib/types";

vi.mock("@/lib/tauri", () => ({
  isBrowser: true,
  clearSettings: vi.fn(),
  getAppVersion: vi.fn(),
  getPreferences: vi.fn(),
  getSettings: vi.fn(),
  getSidecarStatus: vi.fn(),
  savePreferences: vi.fn(),
  saveSettings: vi.fn(),
  selectPresentMonApp: vi.fn(),
  setOverlayOpacity: vi.fn(),
  setOverlayVisible: vi.fn(),
  setPollingRate: vi.fn(),
}));

const { useSettingsStore } = await import("./settings-store");
const tauri = await import("@/lib/tauri");

function presented(value: number): Sensor {
  return {
    name: "Presented Frames",
    identifier: "/presentmon/presented",
    hardwareIdentifier: "/presentmon",
    sensorType: SensorType.Load,
    value,
  };
}

function snapshot(fps: number): HardwareMonitorData {
  return { hardwares: [], sensors: [presented(fps)], lastPollTime: 0 };
}

function reset(showOnlyInGames = false) {
  useSettingsStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      showOverlayOnlyInGames: showOnlyInGames,
    },
    sensorData: null,
    gameActive: false,
    overlayVisible: false,
    pipeStatus: { connected: false },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("game-only overlay visibility", () => {
  it("preserves the original first-reading auto-show when the option is off", () => {
    useSettingsStore.getState().setSensorData(snapshot(0));

    expect(useSettingsStore.getState().overlayVisible).toBe(true);
    expect(tauri.setOverlayVisible).toHaveBeenCalledOnce();
    expect(tauri.setOverlayVisible).toHaveBeenLastCalledWith(true);
  });

  it("shows and hides only when PresentMon game activity changes", () => {
    reset(true);
    const store = useSettingsStore.getState();

    store.setSensorData(snapshot(0));
    expect(tauri.setOverlayVisible).not.toHaveBeenCalled();

    store.setSensorData(snapshot(144));
    store.setSensorData(snapshot(120));
    store.setSensorData(snapshot(0));

    expect(vi.mocked(tauri.setOverlayVisible).mock.calls).toEqual([[true], [false]]);
    expect(useSettingsStore.getState().overlayVisible).toBe(false);
  });

  it("hides when monitoring disconnects and can show after reconnect data", () => {
    reset(true);
    useSettingsStore.setState({ pipeStatus: { connected: true } });
    useSettingsStore.getState().setSensorData(snapshot(144));
    vi.mocked(tauri.setOverlayVisible).mockClear();

    useSettingsStore.getState().setPipeStatus({ connected: false });
    expect(useSettingsStore.getState().gameActive).toBe(false);
    expect(tauri.setOverlayVisible).toHaveBeenLastCalledWith(false);

    useSettingsStore.getState().setSensorData(snapshot(144));
    expect(tauri.setOverlayVisible).toHaveBeenLastCalledWith(true);
  });

  it("does not let the hotkey show the overlay outside a game", () => {
    reset(true);

    useSettingsStore.getState().toggleOverlay();

    expect(useSettingsStore.getState().overlayVisible).toBe(false);
    expect(tauri.setOverlayVisible).not.toHaveBeenCalled();
  });

  it("keeps a manual in-game hide until game activity changes", () => {
    reset(true);
    useSettingsStore.getState().setSensorData(snapshot(144));
    useSettingsStore.getState().toggleOverlay();
    vi.mocked(tauri.setOverlayVisible).mockClear();

    useSettingsStore.getState().setSensorData(snapshot(120));

    expect(useSettingsStore.getState().overlayVisible).toBe(false);
    expect(tauri.setOverlayVisible).not.toHaveBeenCalled();
  });

  it("applies setting changes immediately", () => {
    useSettingsStore.setState({ overlayVisible: true, gameActive: false });

    useSettingsStore.getState().updateSettings({ showOverlayOnlyInGames: true });
    expect(tauri.setOverlayVisible).toHaveBeenLastCalledWith(false);

    useSettingsStore.getState().updateSettings({ showOverlayOnlyInGames: false });
    expect(tauri.setOverlayVisible).toHaveBeenLastCalledWith(true);
  });

  it("hydrates older settings with the option disabled", async () => {
    const oldSettings = { ...DEFAULT_SETTINGS } as Partial<typeof DEFAULT_SETTINGS>;
    delete oldSettings.showOverlayOnlyInGames;
    vi.mocked(tauri.getSettings).mockResolvedValue(
      oldSettings as typeof DEFAULT_SETTINGS,
    );

    await useSettingsStore.getState().loadSettings();

    expect(useSettingsStore.getState().settings.showOverlayOnlyInGames).toBe(false);
  });
});

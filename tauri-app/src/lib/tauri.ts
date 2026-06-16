import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  OverlaySettings,
  HardwareMonitorData,
  PipeStatus,
  MonitorInfo,
  AppPreferences,
} from "./types";

// ─── Browser detection ──────────────────────────────────────────
// When running via `npm run dev` in a browser (no Tauri runtime),
// all invoke/listen calls are no-ops so the UI can be previewed.

export const isBrowser = !(window as any).__TAURI_INTERNALS__;

const noop = () => Promise.resolve(undefined as any);
const noopListen = (): Promise<UnlistenFn> => Promise.resolve(() => {});

async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isBrowser) return undefined as any;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function safeListen<T>(
  event: string,
  handler: (event: { payload: T }) => void
): Promise<UnlistenFn> {
  if (isBrowser) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, handler);
}

// ─── Settings Commands ──────────────────────────────────────────

export const getSettings = () => safeInvoke<OverlaySettings>("get_settings");
export const saveSettings = (settings: OverlaySettings) =>
  safeInvoke("save_settings", { settings });
export const clearSettings = () => safeInvoke("clear_settings");
export const getPreferences = () => safeInvoke<AppPreferences>("get_preferences");
export const savePreferences = (prefs: AppPreferences) =>
  safeInvoke("save_preferences", { prefs });

// ─── Overlay Commands ───────────────────────────────────────────

export const setOverlayVisible = (visible: boolean) =>
  safeInvoke("set_overlay_visible", { visible });
export const setOverlayPosition = (x: number, y: number) =>
  safeInvoke("set_overlay_position", { x, y });
export const setOverlaySize = (width: number, height: number) =>
  safeInvoke("set_overlay_size", { width, height });
export const setOverlayClickThrough = (enabled: boolean) =>
  safeInvoke("set_overlay_click_through", { enabled });
export const setOverlayOpacity = (opacity: number) =>
  safeInvoke("set_overlay_opacity", { opacity });

// ─── Pipe Commands ──────────────────────────────────────────────

export const selectPresentMonApp = (appName: string) =>
  safeInvoke("select_present_mon_app", { appName });
export const refreshPresentMonApps = () =>
  safeInvoke("refresh_present_mon_apps");
export const setPollingRate = (intervalMs: number) =>
  safeInvoke("set_polling_rate", { intervalMs });

// ─── System Commands ────────────────────────────────────────────

export const checkDotnetRuntime = () => safeInvoke<boolean>("check_dotnet_runtime");
export const getMonitors = () =>
  isBrowser
    ? Promise.resolve<MonitorInfo[]>([
        { name: "Monitor 1", primary: true },
        { name: "Monitor 2", primary: false },
      ] as MonitorInfo[])
    : safeInvoke<MonitorInfo[]>("get_monitors");
export const getAppVersion = () =>
  // No Tauri runtime in the browser preview, so fall back to the package.json
  // version injected at build time (see vite.config.ts) rather than a literal
  // placeholder. The packaged app reads CARGO_PKG_VERSION via the Rust command.
  isBrowser ? Promise.resolve(__APP_VERSION__) : safeInvoke<string>("get_app_version");
export const grantAdminConsent = () => safeInvoke("grant_admin_consent");
export const launchHardwareMonitor = () => safeInvoke("launch_hardware_monitor");
export const setAutoStart = (enabled: boolean) => safeInvoke("set_auto_start", { enabled });
export const getAutoStart = () => isBrowser ? Promise.resolve(false) : safeInvoke<boolean>("get_auto_start");

// ─── Updater ────────────────────────────────────────────────────
// Thin wrappers over @tauri-apps/plugin-updater. The returned Update object is
// stateful (its downloadAndInstall lives on the instance), so the updater store
// holds it and drives download/install — these helpers only cross the Tauri
// runtime boundary and guard the browser preview.

export type AppUpdate = import("@tauri-apps/plugin-updater").Update;

// Returns the pending Update when a newer release exists, or null when the app
// is current (or running in the browser preview, which has no Tauri runtime).
export const checkForUpdate = async (): Promise<AppUpdate | null> => {
  if (isBrowser) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
};

// Relaunch the app after an update has been installed.
export const relaunchApp = async (): Promise<void> => {
  if (isBrowser) return;
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
};

// Stop the HardwareMonitor sidecar (+ PresentMon) and its supervisor so the
// updater's installer can overwrite their files. Without this the running
// sidecar holds HardwareMonitor.exe open and the install fails. Must be awaited
// before downloadAndInstall.
export const prepareForUpdate = async (): Promise<void> => {
  if (isBrowser) return;
  await safeInvoke("prepare_for_update");
};

// ─── Event Listeners ────────────────────────────────────────────

export const onSensorData = (
  callback: (data: HardwareMonitorData) => void
): Promise<UnlistenFn> =>
  safeListen<HardwareMonitorData>("sensor-data", (event) =>
    callback(event.payload)
  );

export const onPresentMonApps = (
  callback: (apps: string[]) => void
): Promise<UnlistenFn> =>
  safeListen<string[]>("present-mon-apps", (event) => callback(event.payload));

export const onPipeStatus = (
  callback: (status: PipeStatus) => void
): Promise<UnlistenFn> =>
  safeListen<PipeStatus>("pipe-status", (event) => callback(event.payload));

export const onSettingsChanged = (
  callback: (settings: OverlaySettings) => void
): Promise<UnlistenFn> =>
  safeListen<OverlaySettings>("settings-changed", (event) =>
    callback(event.payload)
  );

export const onHotkey = (
  callback: (action: string) => void
): Promise<UnlistenFn> =>
  safeListen<string>("hotkey", (event) => callback(event.payload));

export const onSetOpacity = (
  callback: (opacity: number) => void
): Promise<UnlistenFn> =>
  safeListen<number>("set-opacity", (event) => callback(event.payload));

// ─── Feedback Commands ──────────────────────────────────────────

export const submitFeedback = (input: {
  name: string;
  message: string;
  attachmentPath?: string;
}): Promise<void> => {
  // Reject in the browser preview rather than no-op — otherwise the dialog
  // would close as if the feedback sent when nothing actually happened.
  if (isBrowser) {
    return Promise.reject(new Error("Feedback can only be sent from the desktop app."));
  }
  return safeInvoke("submit_feedback", { input });
};

// Opens the OS image picker and returns the absolute path + display name.
// Browser preview has no Tauri runtime, so it returns null (no-op).
export const pickImageAttachment = async (): Promise<
  { path: string; name: string } | null
> => {
  if (isBrowser) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (typeof selected !== "string") return null;
  const name = selected.split(/[/\\]/).pop() ?? "attachment";
  return { path: selected, name };
};

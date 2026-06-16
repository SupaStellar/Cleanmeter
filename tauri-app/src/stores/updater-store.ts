import { create } from "zustand";
import { checkForUpdate, relaunchApp, type AppUpdate } from "@/lib/tauri";

export type UpdaterStatus =
  | "idle" // no check run yet this session
  | "checking" // a check is in flight
  | "available" // a newer version exists and is waiting to install
  | "downloading" // user accepted; bytes are streaming
  | "installing" // download done, installer running / about to relaunch
  | "uptodate" // checked, already on the latest version
  | "error"; // check or install failed

// The Update instance is stateful (downloadAndInstall lives on it) and not
// serializable, so it's held outside the reactive store.
let pendingUpdate: AppUpdate | null = null;

interface UpdaterStore {
  status: UpdaterStatus;
  availableVersion: string | null;
  // 0–100 while downloading; -1 when the total size is unknown.
  progress: number;
  error: string | null;
  // User dismissed the badge with "Later" — stays hidden until the next check.
  dismissed: boolean;

  // `silent` (on-launch) checks never surface "up to date" or errors in the UI;
  // a manual check does. Either way, an available update shows the badge.
  check: (opts?: { silent?: boolean }) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: "idle",
  availableVersion: null,
  progress: 0,
  error: null,
  dismissed: false,

  check: async ({ silent = false } = {}) => {
    // Don't stack checks or re-check mid-download.
    const s = get().status;
    if (s === "checking" || s === "downloading" || s === "installing") return;

    set({ status: "checking", error: null });
    try {
      const update = await checkForUpdate();
      if (update) {
        pendingUpdate = update;
        set({
          status: "available",
          availableVersion: update.version,
          dismissed: false,
        });
      } else {
        // No update. Surface "up to date" only for a manual check; a silent
        // launch check goes quiet so nothing flashes on every startup.
        set({
          status: silent ? "idle" : "uptodate",
          availableVersion: null,
        });
      }
    } catch (e) {
      // Silent failures (offline, private release feed, etc.) stay invisible;
      // a manual check shows the error so the user knows it didn't work.
      set({
        status: silent ? "idle" : "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  downloadAndInstall: async () => {
    if (!pendingUpdate) return;
    // Guard re-entrancy (e.g. a rapid double-tap on "Update now") so two
    // installs can't race on the same Update instance.
    const s = get().status;
    if (s === "downloading" || s === "installing") return;
    set({ status: "downloading", progress: 0, error: null });

    let downloaded = 0;
    let contentLength = 0;
    try {
      await pendingUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            set({ progress: contentLength > 0 ? 0 : -1 });
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              set({
                progress: Math.min(
                  100,
                  Math.round((downloaded / contentLength) * 100),
                ),
              });
            }
            break;
          case "Finished":
            set({ status: "installing", progress: 100 });
            break;
        }
      });
      // Installer has run (the Finished event already set "installing");
      // relaunch into the new version. On Windows the NSIS installer may close
      // the app itself, so this is best-effort.
      await relaunchApp();
    } catch (e) {
      set({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));

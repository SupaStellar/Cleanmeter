import { create } from "zustand";
import {
  checkForUpdate,
  prepareForUpdate,
  relaunchApp,
  type AppUpdate,
} from "@/lib/tauri";

export type UpdaterStatus =
  | "idle" // no check run yet this session
  | "checking" // a check is in flight
  | "available" // a newer version exists and is waiting to be downloaded
  | "downloading" // user accepted; bytes are streaming
  | "ready" // downloaded and waiting for the user to install it
  | "installing" // installer running / about to relaunch
  | "uptodate" // checked, already on the latest version
  | "error"; // check, download or install failed

// The Update instance is stateful (download/install live on it) and not
// serializable, so it's held outside the reactive store.
let pendingUpdate: AppUpdate | null = null;

// Which download attempt is current. Cancelling bumps it, which orphans the
// in-flight run: its progress events and its result are both ignored. See
// cancel() for what this can and cannot do.
let downloadRun = 0;

interface UpdaterStore {
  status: UpdaterStatus;
  availableVersion: string | null;
  // 0–100 while downloading; -1 when the total size is unknown.
  progress: number;
  error: string | null;
  // User dismissed the badge with "Later" or the close button. Stays hidden
  // until the next check, which is why "Check for latest updates" brings it
  // back.
  dismissed: boolean;

  // `silent` (on-launch) checks never surface "up to date" or errors in the UI;
  // a manual check does. Either way, an available update shows the badge.
  check: (opts?: { silent?: boolean }) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  cancel: () => void;
  dismiss: () => void;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: "idle",
  availableVersion: null,
  progress: 0,
  error: null,
  dismissed: false,

  check: async ({ silent = false } = {}) => {
    // Don't stack checks or re-check mid-update.
    const s = get().status;
    if (s === "checking" || s === "downloading" || s === "installing") return;

    // A download that is already waiting to install must not be thrown away by
    // a later check: re-surface it instead, which is what "Check for latest
    // updates" should do after the pill was dismissed.
    if (s === "ready") {
      set({ dismissed: false });
      return;
    }

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

  // Download only. Installing is a second, deliberate step: the design has a
  // "ready to install" state with its own button, and an install closes the
  // app, which should never happen as a side effect of a download finishing.
  download: async () => {
    if (!pendingUpdate) return;
    // Guard re-entrancy (e.g. a rapid double-tap on "Update now") so two
    // downloads can't race on the same Update instance.
    const s = get().status;
    if (s === "downloading" || s === "installing") return;

    const run = ++downloadRun;
    set({ status: "downloading", progress: 0, error: null });

    let downloaded = 0;
    let contentLength = 0;
    try {
      await pendingUpdate.download((event) => {
        if (run !== downloadRun) return; // cancelled
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
            set({ progress: 100 });
            break;
        }
      });
      if (run !== downloadRun) return;
      set({ status: "ready", progress: 100 });
    } catch (e) {
      if (run !== downloadRun) return;
      // Back to the offer rather than "error". The pill only renders the four
      // live states, so "error" would take it off screen and leave the row
      // saying the *check* failed, which is a different thing. The message is
      // kept for whoever surfaces it, and logged so a failure is diagnosable.
      const message = e instanceof Error ? e.message : String(e);
      console.error("Update download failed:", message);
      set({ status: "available", progress: 0, error: message });
    }
  },

  install: async () => {
    if (!pendingUpdate) return;
    if (get().status === "installing") return;
    set({ status: "installing", error: null });
    try {
      // Kill the HardwareMonitor sidecar (+ PresentMon) and its supervisor
      // first: a running sidecar holds its .exe open and the NSIS installer
      // would fail to overwrite it ("Error opening file for writing"). This
      // belongs to the install rather than the download, so the sidecar keeps
      // running (and the overlay keeps reading) while bytes come down.
      //
      // One way only: prepare_for_update clears the supervisor's running flag,
      // nothing sets it back, and the supervisor thread returns on seeing it
      // false. If the install then fails, the app has no sensor readings until
      // it restarts, which is why the pill says so rather than re-offering the
      // install as though nothing happened.
      await prepareForUpdate();
      await pendingUpdate.install();
      // Relaunch into the new version. On Windows the NSIS installer may close
      // the app itself, so this is best-effort.
      await relaunchApp();
    } catch (e) {
      // Back to "ready" for the same reason download returns to "available":
      // the bytes are already here, so the pill has to keep offering to
      // install them instead of vanishing and stranding a downloaded update.
      const message = e instanceof Error ? e.message : String(e);
      console.error("Update install failed:", message);
      set({ status: "ready", error: message });
    }
  },

  // Stops tracking the download and returns the pill to its offer.
  //
  // It does not abort the transfer: the updater plugin exposes no way to, so
  // bytes already requested keep arriving and are simply discarded. Cancel is
  // therefore about the UI getting out of the way, not about saving bandwidth.
  cancel: () => {
    downloadRun++;
    set({ status: "available", progress: 0, error: null });
  },

  dismiss: () => set({ dismissed: true }),
}));

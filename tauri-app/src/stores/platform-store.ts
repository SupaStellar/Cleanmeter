import { create } from "zustand";
import { getPlatformInfo, onPlatformInfo, type PlatformInfo } from "@/lib/tauri";

let listening = false;
const linux = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("linux");
export const usePlatformStore = create<{ platform: PlatformInfo; load: () => Promise<void> }>((set) => ({
  platform: { os: linux ? "linux" : "windows", displayBackend: linux ? "x11" : "native", canPositionOverlay: true, globalShortcuts: true, percentileLows: true },
  load: async () => {
    if (!listening) {
      listening = true;
      void onPlatformInfo((platform) => set({ platform })).catch((error) => { listening = false; console.error(error); });
    }
    try { const platform = await getPlatformInfo(); if (platform) set({ platform }); }
    catch (error) { console.error("Could not read platform capabilities", error); }
  },
}));

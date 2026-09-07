import { create } from "zustand";
import { getPlatformInfo, type PlatformInfo } from "@/lib/tauri";

const linux = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("linux");
export const usePlatformStore = create<{ platform: PlatformInfo; load: () => Promise<void> }>((set) => ({
  platform: { os: linux ? "linux" : "windows", displayBackend: linux ? "x11" : "native", canPositionOverlay: true, globalShortcuts: true, percentileLows: !linux },
  load: async () => {
    try { const platform = await getPlatformInfo(); if (platform) set({ platform }); }
    catch (error) { console.error("Could not read platform capabilities", error); }
  },
}));

import type { MonitorInfo } from "./types";

// Display enumeration during Windows sign-in can precede the final topology.
// Retry during startup and after window/display signals without resetting saved coordinates.
const DISPLAY_POLL_BURST_MS = 60_000;
export function watchOverlayDisplays(
  read: () => Promise<MonitorInfo[] | undefined>,
  changed: (monitors: MonitorInfo[]) => void,
  intervalMs = 2000,
): () => void {
  let stopped = false;
  let pending = false;
  let previous = "";
  const refresh = async () => {
    if (stopped || pending) return;
    pending = true;
    try {
      const monitors = await read();
      if (stopped || !monitors?.length) return;
      const signature = JSON.stringify(monitors);
      if (signature !== previous) {
        previous = signature;
        changed(monitors);
      }
    } catch {
      // Transient enumeration failures retain the last usable geometry.
    } finally {
      pending = false;
    }
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  let endBurst: ReturnType<typeof setTimeout> | undefined;
  const stopBurst = () => {
    clearInterval(timer);
    clearTimeout(endBurst);
  };
  const rearm = () => {
    stopBurst();
    void refresh();
    timer = setInterval(() => void refresh(), intervalMs);
    endBurst = setTimeout(stopBurst, DISPLAY_POLL_BURST_MS);
  };

  const viewport = typeof window === "undefined" ? undefined : window;
  let dpi: MediaQueryList | undefined;
  const watchDpi = () => {
    dpi?.removeEventListener("change", onDpiChange);
    dpi = viewport?.matchMedia?.(`(resolution: ${viewport.devicePixelRatio}dppx)`);
    dpi?.addEventListener("change", onDpiChange);
  };
  const onDpiChange = () => {
    watchDpi();
    rearm();
  };

  viewport?.addEventListener("resize", rearm);
  viewport?.document.addEventListener("visibilitychange", rearm);
  watchDpi();
  rearm();
  return () => {
    stopped = true;
    stopBurst();
    viewport?.removeEventListener("resize", rearm);
    viewport?.document.removeEventListener("visibilitychange", rearm);
    dpi?.removeEventListener("change", onDpiChange);
  };
}

import type { MonitorInfo } from "./types";

// Display enumeration during Windows sign-in can precede the final topology.
// Keep refreshing, including after resume, without resetting saved coordinates.
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
  void refresh();
  const timer = setInterval(() => void refresh(), intervalMs);
  return () => { stopped = true; clearInterval(timer); };
}

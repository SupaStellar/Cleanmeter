import { useEffect, useRef, useState } from "react";
import {
  onSensorData,
  onPresentMonApps,
  onPipeStatus,
  onSidecarStatus,
} from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";
import type { HardwareMonitorData } from "@/lib/types";

export function useSensorData() {
  const setSensorData = useSettingsStore((s) => s.setSensorData);
  const setPresentMonApps = useSettingsStore((s) => s.setPresentMonApps);
  const setPipeStatus = useSettingsStore((s) => s.setPipeStatus);
  const setSidecarStatus = useSettingsStore((s) => s.setSidecarStatus);
  const loadSidecarStatus = useSettingsStore((s) => s.loadSidecarStatus);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const u1 = await onSensorData((data) => setSensorData(data));
      if (mounted) unlisteners.push(u1); else u1();

      const u2 = await onPresentMonApps((apps) => setPresentMonApps(apps));
      if (mounted) unlisteners.push(u2); else u2();

      const u3 = await onPipeStatus((status) => setPipeStatus(status));
      if (mounted) unlisteners.push(u3); else u3();

      const u4 = await onSidecarStatus((status) => setSidecarStatus(status));
      if (mounted) unlisteners.push(u4); else u4();

      // Subscribing is not enough: the sidecar is spawned before this webview
      // finishes loading, so its first spawn (or an early crash) has already
      // been emitted and is gone. Read the current value once the listener is
      // in place, so neither path can be missed.
      if (mounted) loadSidecarStatus();
    };
    setup();

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, [setSensorData, setPresentMonApps, setPipeStatus, setSidecarStatus, loadSidecarStatus]);
}

/** Hook for overlay — keeps a rolling buffer of frametime values */
export function useFrametimeHistory(maxPoints = 30) {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const bufferRef = useRef<number[]>([]);
  const prevData = useRef<HardwareMonitorData | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  // Accumulate a rolling buffer by comparing the incoming store value against a
  // ref and updating state during render — React's documented "adjust state
  // when an input changes" pattern, which avoids the extra paint a useEffect
  // would cost. react-hooks/refs flags the render-phase ref reads; they're
  // intentional and safe here (single overlay instance, polled ~every 500ms).
  /* eslint-disable react-hooks/refs */
  if (sensorData && sensorData !== prevData.current) {
    prevData.current = sensorData;

    const frametime = sensorData.sensors.find(
      (s) => s.name.toLowerCase().includes("frametime") || s.identifier.toLowerCase().includes("frametime")
    );
    if (frametime?.value != null) {
      const buf = bufferRef.current;
      buf.push(frametime.value);
      if (buf.length > maxPoints) buf.shift();
      setHistory([...buf]);
    }
  }
  /* eslint-enable react-hooks/refs */

  return history;
}


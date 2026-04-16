import { useEffect, useRef, useState } from "react";
import { onSensorData, onPresentMonApps, onPipeStatus } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
import type { HardwareMonitorData } from "@/lib/types";

export function useSensorData() {
  const setSensorData = useSettingsStore((s) => s.setSensorData);
  const setPresentMonApps = useSettingsStore((s) => s.setPresentMonApps);
  const setPipeStatus = useSettingsStore((s) => s.setPipeStatus);

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
    };
    setup();

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, [setSensorData, setPresentMonApps, setPipeStatus]);
}

/** Hook for overlay — keeps a rolling buffer of frametime values */
export function useFrametimeHistory(maxPoints = 30) {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const bufferRef = useRef<number[]>([]);
  const prevData = useRef<HardwareMonitorData | null>(null);
  const [history, setHistory] = useState<number[]>([]);

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

  return history;
}

/** Hook for overlay — keeps a rolling buffer of network rates */
export function useNetworkHistory(maxPoints = 30) {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const downRef = useRef<number[]>([]);
  const upRef = useRef<number[]>([]);
  const prevData = useRef<HardwareMonitorData | null>(null);
  const [histories, setHistories] = useState<{ downHistory: number[]; upHistory: number[] }>({ downHistory: [], upHistory: [] });

  if (sensorData && sensorData !== prevData.current) {
    prevData.current = sensorData;

    const down = sensorData.sensors.find(
      (s) => s.sensorType === SensorType.Throughput && s.name.toLowerCase().includes("download")
    );
    const up = sensorData.sensors.find(
      (s) => s.sensorType === SensorType.Throughput && s.name.toLowerCase().includes("upload")
    );

    let changed = false;
    if (down?.value != null) {
      downRef.current.push(down.value);
      if (downRef.current.length > maxPoints) downRef.current.shift();
      changed = true;
    }
    if (up?.value != null) {
      upRef.current.push(up.value);
      if (upRef.current.length > maxPoints) upRef.current.shift();
      changed = true;
    }
    if (changed) {
      setHistories({ downHistory: [...downRef.current], upHistory: [...upRef.current] });
    }
  }

  return histories;
}

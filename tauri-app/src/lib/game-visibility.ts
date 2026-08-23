import type { HardwareMonitorData } from "./types";

const PRESENTED_FRAMES_SENSOR_ID = "/presentmon/presented";

/**
 * PresentMon reports frames only for the monitored foreground application.
 * Its sensor drops to zero after the existing stale-frame timeout, which makes
 * it the live game signal without another process scan or polling loop.
 */
export function isGamePresenting(data: HardwareMonitorData | null): boolean {
  const presented = data?.sensors.find(
    (sensor) => sensor.identifier.toLowerCase() === PRESENTED_FRAMES_SENSOR_ID,
  );

  return presented !== undefined && Number.isFinite(presented.value) && presented.value > 0;
}

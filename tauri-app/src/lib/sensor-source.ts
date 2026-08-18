import type { Sensor } from "./types";

/** True when a saved customReadingId is missing from the live sensor list. */
export function customReadingNeedsRefresh(
  customReadingId: string,
  sensors: Sensor[],
): boolean {
  if (!customReadingId) return true;
  if (customReadingId.startsWith("/presentmon/")) return false;
  return !sensors.some((s) => s.identifier === customReadingId);
}

export function isDownloadSensorName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("download") || n.includes("down") || /(^|[^a-z])dl([^a-z]|$)/.test(n);
}

export function isUploadSensorName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("upload") || /(^|[^a-z])up([^a-z]|$)/.test(n);
}

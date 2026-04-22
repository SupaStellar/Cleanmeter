import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge, getDefaultConfig } from "tailwind-merge";
import type { Boundaries, Sensor, SensorType } from "./types";

const isTypography = (v: string) => /^(heading|body|label|link|input|caption|readings)-/.test(v);

const defaultTextColor = getDefaultConfig().classGroups["text-color"][0] as unknown as {
  text: ((v: string) => boolean)[];
};
const textColorValidators = defaultTextColor.text.map((v) =>
  typeof v === "function" ? (val: string) => !isTypography(val) && v(val) : v,
);

const twMerge = extendTailwindMerge<"typography">({
  override: { classGroups: { "text-color": [{ text: textColorValidators }] } },
  extend: { classGroups: { typography: [{ text: [isTypography] }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getBoundaryColor(
  value: number,
  boundaries: Boundaries
): string {
  if (value >= boundaries.high) return "var(--color-danger)";
  if (value >= boundaries.medium) return "var(--color-warning)";
  if (value >= boundaries.low) return "var(--color-success)";
  return "var(--color-success)";
}

export function formatValue(value: number, decimals = 0): string {
  if (isNaN(value) || !isFinite(value)) return "0";
  return value.toFixed(decimals);
}

export function formatTemperature(
  celsius: number,
  unit: "C" | "F",
): { label: string; symbol: string } {
  const display = unit === "F" ? celsius * 9 / 5 + 32 : celsius;
  return { label: formatValue(display), symbol: unit === "F" ? "°F" : "°C" };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes.toFixed(0)} B`;
}

export function formatNetworkRate(bytesPerSec: number): string {
  if (bytesPerSec >= 1048576) return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

export function findSensorByTypeAndHardware(
  sensors: Sensor[],
  sensorType: SensorType,
  hardwareIdentifier?: string
): Sensor | undefined {
  return sensors.find(
    (s) =>
      s.sensorType === sensorType &&
      (!hardwareIdentifier || s.hardwareIdentifier === hardwareIdentifier)
  );
}

export function findSensorById(
  sensors: Sensor[],
  id: string
): Sensor | undefined {
  if (!id) return undefined;
  return sensors.find((s) => s.identifier === id);
}

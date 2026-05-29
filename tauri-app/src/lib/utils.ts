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
  // Figma 2106:2313 ring palette (exact rgba from the design):
  //   danger  → rgb(240,68,56)  = #f04438 = --red500
  //   warning → rgb(254,200,75) = #fec84b = --yellow300 (NOT 500/700)
  //   success → rgb(23,178,106) = #17b26a = --green500
  // The semantic `--color-{danger,warning,success}` tokens point at darker
  // shades (red700, yellow700) chosen for the settings UI — don't reuse
  // them in the overlay, the overlay palette is intentionally brighter.
  if (value >= boundaries.high) return "var(--red500)";
  if (value >= boundaries.medium) return "var(--yellow300)";
  return "var(--green500)";
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

// Split form: the number and its rate unit, so the unit can be rendered with
// the same label/unit styling as %, W, °C, GB (not as part of the value).
export function formatNetworkRateParts(
  bytesPerSec: number,
): { value: string; unit: string } {
  if (bytesPerSec >= 1048576) return { value: (bytesPerSec / 1048576).toFixed(1), unit: "MB/s" };
  if (bytesPerSec >= 1024) return { value: (bytesPerSec / 1024).toFixed(1), unit: "KB/s" };
  return { value: bytesPerSec.toFixed(0), unit: "B/s" };
}

export function formatNetworkRate(bytesPerSec: number): string {
  const { value, unit } = formatNetworkRateParts(bytesPerSec);
  return `${value} ${unit}`;
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

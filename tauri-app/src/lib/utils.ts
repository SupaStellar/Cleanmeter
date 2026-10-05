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
  //
  // Thresholds are the UPPER bound of each segment, matching what the settings
  // control paints (TempRangeControl: Low 0→low, Medium low→medium, High
  // medium→high) and the legacy app's Progress.kt:
  //   value <= low             → green
  //   low < value <= medium    → yellow
  //   value > medium           → red
  // `boundaries.high` is the top of the High segment for display only, never a
  // threshold. Comparing against .high/.medium instead (the bug this replaced)
  // shifted every color one segment late, so green ran past the whole Medium
  // band and red only appeared at the very top of the scale.
  if (value > boundaries.medium) return "var(--red500)";
  if (value > boundaries.low) return "var(--yellow300)";
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

/**
 * Render a clock sensor as whole MHz, or an em dash when there is no reading.
 *
 * The dash covers both ways a clock can be missing, which are not the same
 * thing. The sensor can be absent from the frame entirely (an unsupported CPU
 * exposes no Clock sensors at all, and a modern AMD GPU reports none until
 * ADL's PMLog block has been updated once), or it can be present and reading
 * nothing. The second case arrives as 0, because the sidecar coalesces a null
 * or NaN sensor value to 0f in MapSensor, so 0 has to be treated as "no
 * reading" rather than as a value: no CPU or GPU runs at 0 MHz while it is
 * reporting. Hence "> 0" and not ">= 0".
 */
export function formatClockLabel(clock: Sensor | undefined): string {
  if (!clock || !Number.isFinite(clock.value) || clock.value <= 0) return "—";
  return formatValue(clock.value);
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

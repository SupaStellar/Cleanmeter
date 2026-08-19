import type { Hardware, Sensor } from "./types";
import { HardwareType, SensorType } from "./types";

/**
 * Choosing which GPU the overlay reads from.
 *
 * Every GPU reading (usage, temperature, power, VRAM) is pinned to one GPU,
 * named by `settings.selectedGpuId`. That is a hard constraint rather than a
 * default: the sensor pickers only ever offer sensors from the selected GPU,
 * so a machine with an integrated and a discrete GPU cannot end up showing
 * temperature from one and load from the other.
 *
 * The functions here are pure, which is the point. The behaviour that matters
 * only appears on a machine with two GPUs, and those are exactly the machines
 * we cannot test on.
 */

export const GPU_HARDWARE_TYPES = [
  HardwareType.GpuNvidia,
  HardwareType.GpuAmd,
  HardwareType.GpuIntel,
] as const;

export function isGpu(hardware: Hardware): boolean {
  return (GPU_HARDWARE_TYPES as readonly HardwareType[]).includes(hardware.hardwareType);
}

/** Every GPU the sidecar reported, in the order it sent them. */
export function listGpus(hardwares: Hardware[]): Hardware[] {
  return hardwares.filter(isGpu);
}

/** The sensors belonging to one GPU. Empty for a GPU with no readings yet. */
export function sensorsOnGpu(sensors: Sensor[], gpuId: string): Sensor[] {
  if (!gpuId) return [];
  return sensors.filter((s) => s.hardwareIdentifier === gpuId);
}

/**
 * Dedicated video memory a GPU reports, in whatever unit the sensor uses.
 * Only ever compared against another GPU's, so the unit does not matter.
 *
 * "Shared" totals are excluded deliberately: an integrated GPU has no memory
 * of its own and reports system memory it is allowed to borrow, which on a
 * 32 GB laptop would otherwise outrank a discrete card's 8 GB.
 */
function dedicatedMemory(gpuId: string, sensors: Sensor[]): number {
  let total = 0;

  for (const sensor of sensors) {
    if (sensor.hardwareIdentifier !== gpuId) continue;
    if (sensor.sensorType !== SensorType.SmallData && sensor.sensorType !== SensorType.Data) continue;

    const name = sensor.name.toLowerCase();
    if (!name.includes("memory total") || name.includes("shared")) continue;

    total = Math.max(total, sensor.value ?? 0);
  }

  return total;
}

/**
 * The GPU to use when nobody has chosen one.
 *
 * Ranked by dedicated video memory, because that is what actually separates a
 * discrete card from an integrated one and it comes from a sensor we already
 * receive. Hardware type cannot do it: an AMD integrated GPU reports as
 * GpuAmd exactly like a Radeon card does.
 *
 * Integrated Intel graphics lose the tie when no memory reading has arrived
 * yet, which matters at first launch since sensors activate over the first
 * polls rather than all at once.
 */
export function pickDefaultGpu(gpus: Hardware[], sensors: Sensor[]): string {
  if (gpus.length === 0) return "";

  let best = gpus[0];
  let bestMemory = dedicatedMemory(best.identifier, sensors);

  for (const candidate of gpus.slice(1)) {
    const memory = dedicatedMemory(candidate.identifier, sensors);

    if (memory > bestMemory) {
      best = candidate;
      bestMemory = memory;
      continue;
    }

    // Same memory reading, including the case where neither has one yet.
    if (
      memory === bestMemory &&
      best.hardwareType === HardwareType.GpuIntel &&
      candidate.hardwareType !== HardwareType.GpuIntel
    ) {
      best = candidate;
      bestMemory = memory;
    }
  }

  return best.identifier;
}

/**
 * Which GPU to read from, given what is stored and what is present.
 *
 * Three cases, in order:
 *  - a stored choice that still resolves to a present GPU wins outright;
 *  - otherwise the GPU behind the saved "GPU Usage" sensor is adopted. That is
 *    the upgrade path for settings written before this control existed, and it
 *    anchors on GPU Usage because it is the headline reading and so the one a
 *    user is most likely to have set deliberately;
 *  - otherwise pick a default.
 *
 * The second case is also the repair path for a stored GPU that has gone away,
 * e.g. a card removed, or a placeholder entry replaced by the real thing once
 * its vendor SDK started answering.
 */
export function resolveSelectedGpu(
  storedGpuId: string,
  gpuUsageSensorId: string,
  gpus: Hardware[],
  sensors: Sensor[],
): string {
  if (gpus.length === 0) return storedGpuId;

  if (storedGpuId && gpus.some((g) => g.identifier === storedGpuId)) {
    return storedGpuId;
  }

  const anchor = sensors.find((s) => s.identifier === gpuUsageSensorId);
  if (anchor && gpus.some((g) => g.identifier === anchor.hardwareIdentifier)) {
    return anchor.hardwareIdentifier;
  }

  return pickDefaultGpu(gpus, sensors);
}

/**
 * Whether a GPU reports nothing in THIS snapshot: it has no sensors at all, or
 * has sensors and every one reads 0.
 *
 * A GPU sitting at 0% load but 45°C is reporting perfectly well, just not
 * busy, so this is false for it.
 *
 * Deliberately a statement about one snapshot and nothing more. A single
 * snapshot cannot distinguish "parked" from "has not woken up yet", so callers
 * must not render anything off this directly. See nextGpuSilence.
 */
export function isGpuReportingNothing(gpuId: string, sensors: Sensor[]): boolean {
  if (!gpuId) return false;

  const own = sensorsOnGpu(sensors, gpuId);
  if (own.length === 0) return true;

  return own.every((s) => (s.value ?? 0) === 0);
}

/**
 * How long a GPU has to stay quiet before the UI says so.
 *
 * Sensors do not all arrive at once. LibreHardwareMonitor only exposes a
 * sensor once it has produced a reading, and an AMD GPU reads temperature,
 * power and load through an ADL sampling session that has no sample on the
 * first Update() — so a perfectly healthy GPU reports nothing for the first
 * poll or two of every launch. Two seconds clears that comfortably at any
 * polling rate the app offers, and is short enough that a genuinely parked GPU
 * explains itself before anyone goes looking.
 */
export const GPU_SILENCE_DWELL_MS = 2000;

/**
 * How long the selected GPU has been reporting nothing.
 *
 * `gpuId` is carried so a change of GPU restarts the clock rather than
 * inheriting the previous one's.
 */
export interface GpuSilence {
  gpuId: string;
  /** When it first went quiet, or null while it is reporting. */
  since: number | null;
  /** Quiet for long enough that saying so is safe. This is what the UI reads. */
  settled: boolean;
}

export const NO_GPU_SILENCE: GpuSilence = { gpuId: "", since: null, settled: false };

/**
 * Advance the silence clock by one snapshot.
 *
 * "This GPU is reporting nothing" is a steady-state property, and any answer
 * derived from a single snapshot is a guess during warm-up. So the clock is
 * asymmetric on purpose: slow to accuse, instant to forgive. One reading
 * clears it outright, while claiming silence takes GPU_SILENCE_DWELL_MS of it
 * holding continuously.
 *
 * That also stops a laptop GPU parking and waking through normal use from
 * strobing the notice on and off.
 *
 * Pure, so the whole behaviour is testable without a clock or a DOM.
 */
export function nextGpuSilence(
  previous: GpuSilence,
  gpuId: string,
  sensors: Sensor[],
  now: number,
  dwellMs: number = GPU_SILENCE_DWELL_MS,
): GpuSilence {
  if (!gpuId) return NO_GPU_SILENCE;

  if (!isGpuReportingNothing(gpuId, sensors)) {
    return { gpuId, since: null, settled: false };
  }

  // A different GPU than the one being timed, so start its clock from now
  // rather than inheriting an age it never earned.
  const since = previous.gpuId === gpuId && previous.since !== null ? previous.since : now;

  return { gpuId, since, settled: now - since >= dwellMs };
}

/**
 * Whether a saved GPU sensor choice has to be replaced.
 *
 * Three cases, and the middle one is the whole reason this is a function
 * rather than an inline check:
 *
 *  - nothing chosen yet, so pick something;
 *  - chosen, but that sensor is not in this snapshot at all. Left alone. A
 *    sensor can be missing because it activates late rather than because it is
 *    wrong: LibreHardwareMonitor only exposes a sensor once it has produced a
 *    reading, and an AMD GPU reads temperature, power and load through a
 *    sampling session that has no sample on the first update. Re-picking here
 *    would destroy a deliberate choice on the strength of a snapshot that had
 *    simply not caught up, and the user would never know why;
 *  - chosen, present, and on a different GPU. Replaced. This is the repair
 *    path for settings written before the GPU was pinned, and the reason a
 *    configuration cannot stay mixed.
 */
export function shouldRepickSensor(
  sensorId: string,
  gpuId: string,
  sensors: Sensor[],
): boolean {
  if (!sensorId) return true;

  const sensor = sensors.find((s) => s.identifier === sensorId);
  if (!sensor) return false;

  return sensor.hardwareIdentifier !== gpuId;
}

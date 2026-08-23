import type { Sensor, SensorConfig } from "./types";

type ReadingSelection = Pick<
  SensorConfig,
  "customReadingId" | "additionalReadingIds"
>;

/**
 * Ordered, unique sensor identifiers for one metric. The first identifier is
 * the primary reading and every remaining identifier is supplemental.
 */
export function sensorReadingIds(config: ReadingSelection): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const id of [config.customReadingId, ...(config.additionalReadingIds ?? [])]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

/** Convert an ordered picker result back to the backward-compatible shape. */
export function sensorReadingPatch(ids: readonly string[]): ReadingSelection {
  const normalized = sensorReadingIds({
    customReadingId: ids[0] ?? "",
    additionalReadingIds: ids.slice(1),
  });

  return {
    customReadingId: normalized[0] ?? "",
    additionalReadingIds: normalized.slice(1),
  };
}

export interface SelectedSensorReadings {
  primary: Sensor | undefined;
  additional: Sensor[];
}

/**
 * Resolve configured identifiers against one sensor snapshot while preserving
 * selection order. Missing readings are omitted without changing the saved
 * selection, because GPU sensors can activate a few polls after startup.
 */
export function selectSensorReadings(
  sensors: Sensor[],
  config: ReadingSelection,
  accepts: (sensor: Sensor) => boolean = () => true,
): SelectedSensorReadings {
  const byId = new Map(sensors.map((sensor) => [sensor.identifier, sensor]));
  const available = sensorReadingIds(config)
    .map((id) => byId.get(id))
    .filter((sensor): sensor is Sensor => sensor !== undefined && accepts(sensor));

  return {
    // If the configured primary is late to activate, promote the next live
    // reading for this render only. The saved order remains untouched, so the
    // intended primary resumes automatically when it becomes available.
    primary: available[0],
    additional: available.slice(1),
  };
}

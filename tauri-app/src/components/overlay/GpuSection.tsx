import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { MetricValue } from "./MetricValue";
import { MultiValueMetric } from "./MultiValueMetric";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
import type { Sensor } from "@/lib/types";
import { findSensorById, formatValue, formatTemperature } from "@/lib/utils";

interface GpuSectionProps {
  isHorizontal: boolean;
}

function gpuTemperatureLabel(sensor: Sensor): string {
  const compact = sensor.name
    .replace(/^GPU\s+/i, "")
    .replace(/\s+Temperature$/i, "")
    .trim();
  return compact || sensor.name;
}

export function GpuSection({ isHorizontal }: GpuSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];

  const valueFontSize = settings.fontSizeValue ?? 12;
  const labelFontSize = settings.fontSizeLabel ?? 12;
  const valueFontWeight = settings.fontWeight ?? 500;
  const labelFontWeight = settings.labelFontWeight ?? 500;
  const { gpuTemp, gpuUsage, vramUsage, totalVramUsed, gpuConsumption } =
    settings.sensors;
  const progressType = settings.progressType;

  const anyEnabled =
    gpuTemp.isEnabled ||
    gpuUsage.isEnabled ||
    vramUsage.isEnabled ||
    totalVramUsed.isEnabled ||
    gpuConsumption.isEnabled;

  if (!anyEnabled) return null;

  const Progress = progressType === "bar" ? ProgressBar : ProgressRing;
  const showProgress = progressType !== "none";

  const gpuUsageVal = findSensorById(sensors, gpuUsage.customReadingId)?.value ?? 0;
  const gpuPowerVal = findSensorById(sensors, gpuConsumption.customReadingId)?.value ?? 0;

  // LibreHardwareMonitor's "GPU Memory *" readings are SmallData (MB); a
  // Data-typed sensor the user picked manually is already in GB.
  const toGigabytes = (s: Sensor | undefined): number =>
    s == null ? 0 : s.sensorType === SensorType.SmallData ? (s.value ?? 0) / 1024 : s.value ?? 0;

  // Anchor VRAM lookups to the selected GPU.
  //
  // This used to anchor to whichever GPU the configured "GPU Memory Used"
  // sensor happened to sit on, which let the cluster straddle two GPUs: the
  // used/total pair came from that sensor's GPU while the load fallback below
  // came from vramUsage.customReadingId, and nothing tied the two together.
  // The stored GPU is the one the user actually chose, so it is the honest
  // anchor. The fallback keeps a settings file written before that field
  // existed working until the next poll fills it in.
  const vramUsedConfigured = findSensorById(sensors, totalVramUsed.customReadingId);
  const gpuHwId = settings.selectedGpuId || vramUsedConfigured?.hardwareIdentifier;
  const onGpu = (re: RegExp): Sensor | undefined =>
    gpuHwId ? sensors.find((s) => s.hardwareIdentifier === gpuHwId && re.test(s.name)) : undefined;

  // Prefer LHM's D3D "Dedicated Memory Used" counter — it matches Task Manager
  // and nvidia-smi. The NVAPI "GPU Memory Used" reading it would otherwise use
  // runs a few hundred MB high (e.g. 15.0 GB vs a true 14.7 GB), which both
  // inflates the GB label and pushes the ring a couple points past reality.
  const vramUsedSensor = onGpu(/dedicated memory used/i) ?? vramUsedConfigured;
  const vramUsedVal = toGigabytes(vramUsedSensor);

  // Ring fill = allocated fraction = used / total dedicated memory. We
  // deliberately do NOT trust the "GPU Memory" Load sensor
  // (vramUsage.customReadingId): on NVIDIA/LibreHardwareMonitor it reports
  // memory-*controller* utilization (bandwidth), not allocation — a nearly-full
  // 15.5/16 GB card reads ~10% there. Fall back to that Load sensor only when no
  // total reading is exposed (some AMD/Intel setups).
  const vramLoadVal = findSensorById(sensors, vramUsage.customReadingId)?.value ?? 0;
  const vramTotalVal = toGigabytes(onGpu(/memory total/i));
  const vramUsageVal =
    vramTotalVal > 0
      ? Math.min((vramUsedVal / vramTotalVal) * 100, 100)
      : vramLoadVal;

  const metricTextProps = {
    valueFontSize,
    labelFontSize,
    valueFontWeight,
    labelFontWeight,
  };

  return (
    <Pill title="GPU" isHorizontal={isHorizontal}>
      {gpuTemp.isEnabled && (
        <MultiValueMetric
          sensors={sensors}
          config={gpuTemp}
          progressType={progressType}
          format={(value) => {
            const temperature = formatTemperature(value, settings.temperatureUnit);
            return { value: temperature.label, unit: temperature.symbol };
          }}
          labelForSensor={gpuTemperatureLabel}
          boundaries={gpuTemp.boundaries}
          accepts={(sensor) =>
            !settings.selectedGpuId || sensor.hardwareIdentifier === settings.selectedGpuId
          }
          {...metricTextProps}
        />
      )}
      {gpuUsage.isEnabled && (
        showProgress ? (
          <Progress
            value={gpuUsageVal}
            max={100}
            label={formatValue(gpuUsageVal)}
            unit="%"
            boundaries={gpuUsage.boundaries}
          />
        ) : (
          <MetricValue value={formatValue(gpuUsageVal)} unit="%" {...metricTextProps} />
        )
      )}
      {/* VRAM is gated on vramUsage alone — totalVramUsed is a removed-from-UI
          flag the settings can never re-enable, so requiring it hid VRAM
          entirely. The GB number still comes from totalVramUsed's reading id
          (auto-filled); fall back to % when no GB reading is available. */}
      {vramUsage.isEnabled && (
        showProgress ? (
          <Progress
            value={vramUsageVal}
            max={100}
            label={vramUsedVal > 0 ? formatValue(vramUsedVal, 1) : formatValue(vramUsageVal, 0)}
            unit={vramUsedVal > 0 ? "GB" : "%"}
            boundaries={vramUsage.boundaries}
          />
        ) : (
          <MetricValue
            value={vramUsedVal > 0 ? formatValue(vramUsedVal, 1) : formatValue(vramUsageVal, 0)}
            unit={vramUsedVal > 0 ? "GB" : "%"}
            {...metricTextProps}
          />
        )
      )}
      {/* Power consumption has no threshold ring in the canonical build —
          always a plain value + unit (matches v2.2.x early build). */}
      {gpuConsumption.isEnabled && (
        <MetricValue value={formatValue(gpuPowerVal)} unit="W" {...metricTextProps} />
      )}
    </Pill>
  );
}

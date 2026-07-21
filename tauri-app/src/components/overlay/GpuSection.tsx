import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
import type { Sensor } from "@/lib/types";
import { findSensorById, formatValue, formatTemperature } from "@/lib/utils";

interface GpuSectionProps {
  isHorizontal: boolean;
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

  const gpuTempVal = findSensorById(sensors, gpuTemp.customReadingId)?.value ?? 0;
  const gpuUsageVal = findSensorById(sensors, gpuUsage.customReadingId)?.value ?? 0;
  const gpuPowerVal = findSensorById(sensors, gpuConsumption.customReadingId)?.value ?? 0;

  // LibreHardwareMonitor's "GPU Memory *" readings are SmallData (MB); a
  // Data-typed sensor the user picked manually is already in GB.
  const toGigabytes = (s: Sensor | undefined): number =>
    s == null ? 0 : s.sensorType === SensorType.SmallData ? (s.value ?? 0) / 1024 : s.value ?? 0;

  // Anchor VRAM lookups to the GPU of the configured "GPU Memory Used" sensor.
  const vramUsedConfigured = findSensorById(sensors, totalVramUsed.customReadingId);
  const gpuHwId = vramUsedConfigured?.hardwareIdentifier;
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

  const temp = formatTemperature(gpuTempVal, settings.temperatureUnit);

  return (
    <Pill title="GPU" isHorizontal={isHorizontal}>
      {gpuTemp.isEnabled && (
        showProgress ? (
          <Progress
            value={gpuTempVal}
            max={100}
            label={temp.label}
            unit={temp.symbol}
            boundaries={gpuTemp.boundaries}
          />
        ) : (
          <div className="flex items-center gap-1">
            <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
              {temp.label}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{temp.symbol}</span>
          </div>
        )
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
          <div className="flex items-center gap-1">
            <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
              {formatValue(gpuUsageVal)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>%</span>
          </div>
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
          <div className="flex items-center gap-1">
            <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
              {vramUsedVal > 0 ? formatValue(vramUsedVal, 1) : formatValue(vramUsageVal, 0)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{vramUsedVal > 0 ? "GB" : "%"}</span>
          </div>
        )
      )}
      {/* Power consumption has no threshold ring in the canonical build —
          always a plain value + unit (matches v2.2.x early build). */}
      {gpuConsumption.isEnabled && (
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {formatValue(gpuPowerVal)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>W</span>
        </div>
      )}
    </Pill>
  );
}

import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
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
  const vramUsageVal = findSensorById(sensors, vramUsage.customReadingId)?.value ?? 0;
  const vramUsedSensor = findSensorById(sensors, totalVramUsed.customReadingId);
  // LibreHardwareMonitor's "GPU Memory Used" is SmallData (MB). Pass through
  // when the user picked a Data-typed sensor that's already in GB.
  const vramUsedVal =
    vramUsedSensor?.sensorType === SensorType.SmallData
      ? (vramUsedSensor.value ?? 0) / 1024
      : vramUsedSensor?.value ?? 0;
  const gpuPowerVal = findSensorById(sensors, gpuConsumption.customReadingId)?.value ?? 0;

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

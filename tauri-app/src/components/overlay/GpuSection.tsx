import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { findSensorById, formatValue } from "@/lib/utils";

interface GpuSectionProps {
  isHorizontal: boolean;
}

export function GpuSection({ isHorizontal }: GpuSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];

  const valueFontSize = settings.fontSizeValue ?? 12;
  const labelFontSize = settings.fontSizeLabel ?? 12;
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
  const vramUsedVal = findSensorById(sensors, totalVramUsed.customReadingId)?.value ?? 0;
  const gpuPowerVal = findSensorById(sensors, gpuConsumption.customReadingId)?.value ?? 0;

  return (
    <Pill title="GPU" isHorizontal={isHorizontal}>
      {gpuTemp.isEnabled && (
        showProgress ? (
          <Progress
            value={gpuTempVal}
            max={100}
            label={formatValue(gpuTempVal)}
            unit="°C"
            boundaries={gpuTemp.boundaries}
          />
        ) : (
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
              {formatValue(gpuTempVal)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>°C</span>
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
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
              {formatValue(gpuUsageVal)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>%</span>
          </div>
        )
      )}
      {vramUsage.isEnabled && totalVramUsed.isEnabled && (
        showProgress ? (
          <Progress
            value={vramUsageVal}
            max={100}
            label={formatValue(vramUsedVal, 1)}
            unit="GB"
            boundaries={vramUsage.boundaries}
          />
        ) : (
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
              {formatValue(vramUsedVal, 1)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>GB</span>
          </div>
        )
      )}
      {gpuConsumption.isEnabled && (
        <div className="flex items-baseline gap-0.5">
          <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
            {formatValue(gpuPowerVal)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>W</span>
        </div>
      )}
    </Pill>
  );
}

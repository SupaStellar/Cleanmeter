import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { findSensorById, formatValue, formatTemperature } from "@/lib/utils";

interface CpuSectionProps {
  isHorizontal: boolean;
}

export function CpuSection({ isHorizontal }: CpuSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];

  const valueFontSize = settings.fontSizeValue ?? 12;
  const labelFontSize = settings.fontSizeLabel ?? 12;
  const { cpuTemp, cpuUsage, cpuConsumption } = settings.sensors;
  const progressType = settings.progressType;

  const anyEnabled =
    cpuTemp.isEnabled || cpuUsage.isEnabled || cpuConsumption.isEnabled;

  if (!anyEnabled) return null;

  const Progress = progressType === "bar" ? ProgressBar : ProgressRing;
  const showProgress = progressType !== "none";

  const cpuTempVal = findSensorById(sensors, cpuTemp.customReadingId)?.value ?? 0;
  const cpuUsageVal = findSensorById(sensors, cpuUsage.customReadingId)?.value ?? 0;
  const cpuPowerVal = findSensorById(sensors, cpuConsumption.customReadingId)?.value ?? 0;

  const temp = formatTemperature(cpuTempVal, settings.temperatureUnit);

  return (
    <Pill title="CPU" isHorizontal={isHorizontal}>
      {cpuTemp.isEnabled && (
        showProgress ? (
          <Progress
            value={cpuTempVal}
            max={100}
            label={temp.label}
            unit={temp.symbol}
            boundaries={cpuTemp.boundaries}
          />
        ) : (
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
              {temp.label}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>{temp.symbol}</span>
          </div>
        )
      )}
      {cpuUsage.isEnabled && (
        showProgress ? (
          <Progress
            value={cpuUsageVal}
            max={100}
            label={formatValue(cpuUsageVal)}
            unit="%"
            boundaries={cpuUsage.boundaries}
          />
        ) : (
          <div className="flex items-baseline gap-0.5">
            <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
              {formatValue(cpuUsageVal)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>%</span>
          </div>
        )
      )}
      {cpuConsumption.isEnabled && (
        <div className="flex items-baseline gap-0.5">
          <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
            {formatValue(cpuPowerVal)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>W</span>
        </div>
      )}
    </Pill>
  );
}

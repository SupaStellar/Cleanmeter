import { Pill } from "./Pill";
import { ProgressRing } from "./ProgressRing";
import { ProgressBar } from "./ProgressBar";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
import { formatValue } from "@/lib/utils";

interface RamSectionProps {
  isHorizontal: boolean;
}

export function RamSection({ isHorizontal }: RamSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];

  const { ramUsage } = settings.sensors;
  const progressType = settings.progressType;

  if (!ramUsage.isEnabled) return null;

  const Progress = progressType === "bar" ? ProgressBar : ProgressRing;
  const showProgress = progressType !== "none";

  // Find RAM load sensor
  const ramSensor = sensors.find(
    (s) =>
      s.sensorType === SensorType.Load &&
      s.name.toLowerCase().includes("memory")
  );
  // Find RAM data sensor (used GB)
  const ramDataSensor = sensors.find(
    (s) =>
      s.sensorType === SensorType.Data &&
      s.name.toLowerCase().includes("memory") &&
      s.name.toLowerCase().includes("used")
  );

  const ramPercent = ramSensor?.value ?? 0;
  const ramUsedGB = ramDataSensor?.value ?? 0;

  return (
    <Pill title="RAM" isHorizontal={isHorizontal}>
      {showProgress ? (
        <Progress
          value={ramPercent}
          max={100}
          label={formatValue(ramPercent, 0)}
          unit="%"
          boundaries={ramUsage.boundaries}
        />
      ) : (
        <div className="flex items-baseline gap-0.5">
          <span className="text-xs font-medium text-white tabular-nums">
            {ramUsedGB > 0 ? formatValue(ramUsedGB, 1) : formatValue(ramPercent, 0)}
          </span>
          <span className="text-[9px] text-white/50">{ramUsedGB > 0 ? "GB" : "%"}</span>
        </div>
      )}
    </Pill>
  );
}

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

  const valueFontSize = settings.fontSizeValue ?? 12;
  const labelFontSize = settings.fontSizeLabel ?? 12;
  const valueFontWeight = settings.fontWeight ?? 500;
  const labelFontWeight = settings.labelFontWeight ?? 500;
  const { ramUsage } = settings.sensors;
  const progressType = settings.progressType;

  if (!ramUsage.isEnabled) return null;

  const Progress = progressType === "bar" ? ProgressBar : ProgressRing;
  const showProgress = progressType !== "none";

  // Match the exact sensor names the previous builds (and the legacy app)
  // relied on: on LHM <= 0.9.5 "Memory"/"Memory Used" are unique because the
  // virtual sensors carry a "Virtual " name prefix. LHM 0.9.6 instead splits
  // memory into Total (/ram) and Virtual (/vram) hardware nodes whose sensors
  // share the SAME names, so additionally reject /vram identifiers — the
  // match stays pinned to physical memory under either layout (first-match
  // over the raw sensor array otherwise flips to committed memory, ~total
  // RAM, depending on enumeration order).
  const ramSensor = sensors.find(
    (s) =>
      s.sensorType === SensorType.Load &&
      s.name === "Memory" &&
      !s.identifier.startsWith("/vram")
  );
  // Find RAM data sensor (used GB)
  const ramDataSensor = sensors.find(
    (s) =>
      s.sensorType === SensorType.Data &&
      s.name === "Memory Used" &&
      !s.identifier.startsWith("/vram")
  );

  const ramPercent = ramSensor?.value ?? 0;
  const ramUsedGB = ramDataSensor?.value ?? 0;

  return (
    <Pill title="RAM" isHorizontal={isHorizontal}>
      {showProgress ? (
        <Progress
          value={ramPercent}
          max={100}
          label={ramUsedGB > 0 ? formatValue(ramUsedGB, 1) : formatValue(ramPercent, 0)}
          unit={ramUsedGB > 0 ? "GB" : "%"}
          boundaries={ramUsage.boundaries}
        />
      ) : (
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {ramUsedGB > 0 ? formatValue(ramUsedGB, 1) : formatValue(ramPercent, 0)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{ramUsedGB > 0 ? "GB" : "%"}</span>
        </div>
      )}
    </Pill>
  );
}

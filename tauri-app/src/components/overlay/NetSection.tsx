import { Pill } from "./Pill";
import { NetGraph } from "./NetGraph";
import { useSettingsStore } from "@/stores/settings-store";
import { useNetworkHistory } from "@/hooks/useSensorData";
import { findSensorById, formatNetworkRate } from "@/lib/utils";

interface NetSectionProps {
  isHorizontal: boolean;
}

export function NetSection({ isHorizontal }: NetSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const { downHistory, upHistory } = useNetworkHistory();
  const sensors = sensorData?.sensors ?? [];

  const valueFontSize = settings.fontSizeValue ?? 12;
  const valueFontWeight = settings.fontWeight ?? 500;
  const labelFontSize = settings.fontSizeLabel ?? 12;
  const labelFontWeight = settings.labelFontWeight ?? 500;
  const { downRate, upRate } = settings.sensors;
  const showNetGraph = settings.netGraph;

  const anyEnabled = downRate.isEnabled || upRate.isEnabled || showNetGraph;
  if (!anyEnabled) return null;

  const downVal = findSensorById(sensors, downRate.customReadingId)?.value ?? 0;
  const upVal = findSensorById(sensors, upRate.customReadingId)?.value ?? 0;

  return (
    <Pill title="NET" isHorizontal={isHorizontal}>
      {downRate.isEnabled && (
        // Figma 2169:5351 NET sub-pill: [value, arrow] order, gap 4. Arrow is a
        // white ↓ text glyph at label size (not a colored icon).
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {formatNetworkRate(downVal)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>↓</span>
        </div>
      )}
      {upRate.isEnabled && (
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {formatNetworkRate(upVal)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>↑</span>
        </div>
      )}
      {showNetGraph && (
        <NetGraph
          downHistory={downHistory}
          upHistory={upHistory}
          width={isHorizontal ? 60 : 80}
          height={isHorizontal ? 20 : 24}
        />
      )}
    </Pill>
  );
}

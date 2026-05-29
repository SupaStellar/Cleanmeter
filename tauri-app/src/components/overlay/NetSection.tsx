import { Pill } from "./Pill";
import { NetGraph } from "./NetGraph";
import { useSettingsStore } from "@/stores/settings-store";
import { useNetworkHistory } from "@/hooks/useSensorData";
import { findSensorById, formatNetworkRateParts } from "@/lib/utils";

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

  const down = formatNetworkRateParts(findSensorById(sensors, downRate.customReadingId)?.value ?? 0);
  const up = formatNetworkRateParts(findSensorById(sensors, upRate.customReadingId)?.value ?? 0);

  return (
    <Pill title="NET" isHorizontal={isHorizontal}>
      {downRate.isEnabled && (
        // Figma 2169:5351 NET sub-pill: [value, unit, arrow] order, gap 4. The
        // rate unit (KB/s, MB/s) is a label — same styling as %, W, GB — not
        // part of the value. Arrow is a white ↓ text glyph at label size.
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {down.value}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{down.unit}</span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>↓</span>
        </div>
      )}
      {upRate.isEnabled && (
        <div className="flex items-center gap-1">
          <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
            {up.value}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "0.04em" }}>{up.unit}</span>
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

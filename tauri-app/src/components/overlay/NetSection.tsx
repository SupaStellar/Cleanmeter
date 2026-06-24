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

  // Value vs label/unit styling — same split as the other sections (value
  // hugs at -0.02em letterSpacing; unit/arrow use the label treatment at
  // +0.04em). Extracted to avoid repeating the style object on every span.
  const valueStyle: React.CSSProperties = {
    fontSize: valueFontSize,
    fontWeight: valueFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "-0.02em",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: labelFontSize,
    fontWeight: labelFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "0.04em",
  };
  // The ↓/↑ arrows are a fixed 12×15 glyph box (Figma node — TEXT "↓"/"↑"
  // [12×15] @ size 12). They never scale with the Label/Stats font; the arrow
  // is centered in the box so the NET row stays stable across font sizes.
  const arrowStyle: React.CSSProperties = {
    width: 12,
    height: 15,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: labelFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "0.04em",
  };

  return (
    <Pill title="NET" isHorizontal={isHorizontal}>
      {downRate.isEnabled && (
        // Figma 2169:5351 NET sub-pill: [value, unit, arrow] order, gap 4. The
        // rate unit (KB/s, MB/s) is a label — same styling as %, W, GB — not
        // part of the value. Arrow is a white ↓ text glyph at label size.
        <div className="flex items-center gap-1">
          <span style={valueStyle} className="tabular-nums">{down.value}</span>
          <span style={labelStyle}>{down.unit}</span>
          <span style={arrowStyle}>↓</span>
        </div>
      )}
      {upRate.isEnabled && (
        <div className="flex items-center gap-1">
          <span style={valueStyle} className="tabular-nums">{up.value}</span>
          <span style={labelStyle}>{up.unit}</span>
          <span style={arrowStyle}>↑</span>
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

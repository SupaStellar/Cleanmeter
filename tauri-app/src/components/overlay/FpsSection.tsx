import { Pill } from "./Pill";
import { FrametimeGraph } from "./FrametimeGraph";
import { useSettingsStore } from "@/stores/settings-store";
import { useFrametimeHistory } from "@/hooks/useSensorData";
import { findSensorById } from "@/lib/utils";
import { formatValue } from "@/lib/utils";

interface FpsSectionProps {
  isHorizontal: boolean;
}

export function FpsSection({ isHorizontal }: FpsSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const sensorData = useSettingsStore((s) => s.sensorData);
  const frametimeHistory = useFrametimeHistory();
  const sensors = sensorData?.sensors ?? [];

  const valueFontSize = settings.fontSizeValue ?? 12;
  const labelFontSize = settings.fontSizeLabel ?? 12;
  const valueFontWeight = settings.fontWeight ?? 500;
  const labelFontWeight = settings.labelFontWeight ?? 500;
  const { framerate, frametime, onePercentLow, zeroPointOnePercentLow } = settings.sensors;
  if (
    !framerate.isEnabled &&
    !frametime.isEnabled &&
    !onePercentLow.isEnabled &&
    !zeroPointOnePercentLow.isEnabled
  )
    return null;

  // Resolve the FPS sensor: the configured reading first, then fall back to the
  // PresentMon "presented" sensor (frametime-derived — populated on every GPU,
  // including APUs/iGPUs). The old name-only fallback searched for "fps"/
  // "framerate", but the PresentMon sensors are named "Presented Frames"/
  // "Displayed Frames", so it never matched and unconfigured installs silently
  // read 0.
  const fpsSensor =
    findSensorById(sensors, framerate.customReadingId) ??
    sensors.find((s) => s.identifier === "/presentmon/presented") ??
    sensors.find(
      (s) =>
        s.identifier.toLowerCase().includes("presented") ||
        s.name.toLowerCase().includes("presented") ||
        s.name.toLowerCase().includes("fps") ||
        s.name.toLowerCase().includes("framerate")
    );

  // Percentile lows, same custom-reading-then-identifier resolution. No
  // name-based fallback: these identifiers only ever come from our own
  // PresentMon poller, so there is no third-party naming to guess at.
  const onePercentLowSensor =
    findSensorById(sensors, onePercentLow.customReadingId) ??
    sensors.find((s) => s.identifier === "/presentmon/onepercentlow");
  const zeroPointOneLowSensor =
    findSensorById(sensors, zeroPointOnePercentLow.customReadingId) ??
    sensors.find((s) => s.identifier === "/presentmon/zeropointonepercentlow");

  const fpsValue = Math.round(fpsSensor?.value ?? 0);
  const onePercentValue = Math.round(onePercentLowSensor?.value ?? 0);
  const zeroPointOneValue = Math.round(zeroPointOneLowSensor?.value ?? 0);
  const lastFrametime = frametimeHistory.length > 0 ? frametimeHistory[frametimeHistory.length - 1] : 0;
  const showFrametime = frametime.isEnabled && frametimeHistory.length > 2;
  // The sidecar reports 0 for a low during its warm-up (the first few seconds
  // of a session, and again after the monitored app changes or the game is
  // gone). Hiding the cluster is right rather than printing "0 1%", which
  // reads as "your worst frames were 0 fps".
  const showOnePercent = onePercentLow.isEnabled && onePercentValue > 0;
  const showZeroPointOne = zeroPointOnePercentLow.isEnabled && zeroPointOneValue > 0;

  const valueStyle: React.CSSProperties = {
    fontSize: valueFontSize,
    fontWeight: valueFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "-0.02em",
  };
  // Figma 2785:1409 / 2785:1414: the "1%" and "0.1%" suffixes take the same
  // node treatment as every other unit in the HUD — label font, label weight,
  // +4% tracking — so they follow the Label font settings while their numbers
  // follow the Stats font, exactly like "°C", "%" and "GB".
  //
  // Colour deviates from those two nodes on purpose (Saad, 2026-08-27): they
  // carry node opacity 0.7 in the frame, but the units they sit next to
  // ("°C" 2785:1356, "%" 2785:1373, "GB" 2785:1380) are all full white, and
  // only "ms" is muted. Full white keeps the lows reading as units of a
  // reading rather than as secondary text.
  const suffixStyle: React.CSSProperties = {
    fontSize: labelFontSize,
    fontWeight: labelFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "0.04em",
  };

  // "6.2 ms" keeps its 0.7 (Figma 2785:1343 / 2785:1545), unchanged.
  const frametimeStyle: React.CSSProperties = {
    ...suffixStyle,
    color: "var(--overlay-text-muted)",
  };

  const valueText = framerate.isEnabled && (
    <span style={valueStyle} className="tabular-nums">
      {formatValue(fpsValue)}
    </span>
  );

  // Figma 2785:1407 / 2785:1412 (Frame 57): value and suffix are one cluster at
  // gap 4, and each cluster is a sibling of the average at the pill's own 12px
  // spacing — the lows are full-size readings, not decorations on the average.
  const lowCluster = (value: number, suffix: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={valueStyle} className="tabular-nums">
        {formatValue(value)}
      </span>
      <span style={suffixStyle} className="tabular-nums">
        {suffix}
      </span>
    </div>
  );

  const frametimeText = showFrametime && (
    <span className="tabular-nums" style={frametimeStyle}>
      {formatValue(lastFrametime, 1)} ms
    </span>
  );

  if (isHorizontal) {
    // Figma 2785:1337: the pill's own 12px spacing separates FPS / 120 / the
    // two low clusters / the graph cluster. The graph and its "6.2 ms" stay a
    // tighter 6px pair (2785:1402), but the average is no longer inside that
    // pair the way it was before the lows existed.
    //
    // The 100×7 band sits at y=9 of the 29-high row (measured on 2785:1342) —
    // 2px above flex-center (y=11) — so nudge the centered canvas up by that
    // constant. Same offset as before; the graph frame did not move.
    return (
      <Pill title="FPS" isHorizontal>
        {valueText}
        {showOnePercent && lowCluster(onePercentValue, "1%")}
        {showZeroPointOne && lowCluster(zeroPointOneValue, "0.1%")}
        {showFrametime && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", top: -2 }}>
              <FrametimeGraph history={frametimeHistory} width={100} />
            </div>
            {frametimeText}
          </div>
        )}
      </Pill>
    );
  }

  // Figma 2785:1476: the value row holds "120" plus both low clusters at the
  // pill's 12px gap, and the graph gets its own row below at the pill's 8px
  // row gap. The "6.2 ms" reading now lives in THAT row beside the graph
  // (2785:1542, gap 6) rather than up in the value row where it used to sit —
  // with two more numbers on the value row it no longer fits there.
  //
  // Row height tracks the value font: Figma's 29 is the 24px value text at the
  // HUD's unitless 1.2 line-height (OverlayHud.tsx), and the row is sized to
  // match the value row above it, so deriving it keeps the two rows equal at
  // every font step instead of pinning one sweep's number.
  const graphRowHeight = Math.round(valueFontSize * 1.2);
  return (
    <Pill
      title="FPS"
      isHorizontal={false}
      graphRow={
        showFrametime && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: graphRowHeight }}>
            <div style={{ flex: 1, minWidth: 0, position: "relative", top: -2 }}>
              <FrametimeGraph history={frametimeHistory} width="fill" />
            </div>
            {frametimeText}
          </div>
        )
      }
    >
      {valueText}
      {showOnePercent && lowCluster(onePercentValue, "1%")}
      {showZeroPointOne && lowCluster(zeroPointOneValue, "0.1%")}
    </Pill>
  );
}

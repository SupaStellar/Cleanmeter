import { Pill } from "./Pill";
import { FrametimeGraph } from "./FrametimeGraph";
import { useSettingsStore } from "@/stores/settings-store";
import { useFrametimeHistory } from "@/hooks/useSensorData";
import { findSensorById } from "@/lib/utils";
import { formatValue } from "@/lib/utils";

/**
 * Frametime graph width, in CSS pixels — the same number in both layouts
 * (Saad, 2026-08-28).
 *
 * Overrides the frame, which draws two different widths and stretches the
 * vertical one: 153 on the horizontal board (2826:10742) and a column-filling
 * 251 on the vertical (2819:10142, layoutSizingHorizontal FILL). One fixed
 * width instead, so the trace reads at the same scale wherever it is shown
 * and a wider HUD does not silently re-scale the history against it.
 *
 * Fixed like the divider's 10px, and for the same reason: it is a measured
 * band, not type, so it does not track the font-size settings.
 */
const GRAPH_WIDTH = 200;

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
  // A low with no reading yet reads 0, and the cluster STAYS on screen.
  //
  // The sidecar reports 0 while it warms up — LOWS_MIN_TOTAL_MS is 5s, and
  // the clock restarts every time a recording run begins, the monitored app
  // changes, or the game has been gone for LOWS_ABANDON_MS. Hiding the
  // cluster through that was wrong in the one place it matters most: pressing
  // "start recording" cleared the histogram, both lows vanished for a full
  // five seconds, and the pill shrank and then grew again when they came
  // back. Geometry moving on its own is bad on a HUD pinned over a game, and
  // it read as though the hotkey had switched the readings off. Afterburner
  // does not drop the row when a benchmark begins either.
  //
  // 0, not a dash. A dash was tried and it is unusable for a reason specific
  // to these two readings: their suffix STARTS WITH A DIGIT, so "- 1%" at
  // gap 4 renders as "-1%" and reads as NEGATIVE one percent (Saad,
  // 2026-08-28). No placeholder glyph survives sitting next to "1%".
  //
  // 0 is also what the rest of this pill already does with no data — the
  // average reads "0" and the frametime "0.0 ms" on an idle desktop, so a low
  // reading 0 alongside them is the whole pill speaking one language. The
  // earlier worry that "0 1%" reads as "your worst frames were 0 fps" bites
  // only while the average shows a live number, and it is the lesser evil
  // against a value that looks negative.
  const showOnePercent = onePercentLow.isEnabled;
  const showZeroPointOne = zeroPointOnePercentLow.isEnabled;

  const valueStyle: React.CSSProperties = {
    fontSize: valueFontSize,
    fontWeight: valueFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "-0.02em",
  };
  // The "1%" and "0.1%" suffixes: label font, label weight, +4% tracking, and
  // FULL white — Figma 2826:10735 / 2826:10739 (and 2819:10136 / 2819:10140 on
  // the vertical board) carry no node opacity at all, exactly like the units
  // next door ("°C" 2826:10761, "%", "GB"). Only the pill labels and "6.2 ms"
  // are dimmed in the frame.
  //
  // This was briefly muted to 0.7, on the theory that a full-white "1%" butts
  // against its digits and "65 1%" reads as one number. The frame answers that
  // a different way: the 24% rule below separates the average from the lows,
  // so the suffix does not have to be dimmed to earn its edge. Separation by
  // rule, not by fading a reading the user is meant to read.
  const suffixStyle: React.CSSProperties = {
    fontSize: labelFontSize,
    fontWeight: labelFontWeight,
    color: "var(--overlay-text)",
    fontFamily: "Inter",
    letterSpacing: "0.04em",
  };

  // "6.2 ms" is the SAME type but NOT the same colour — Figma 2826:10744 puts
  // node opacity 0.7 on it, the one reading in the pill that is dimmed. Kept
  // as its own object rather than aliasing suffixStyle: the two were aliased
  // while both were muted, and flipping the suffix to full white silently
  // took the frametime with it.
  const frametimeStyle: React.CSSProperties = {
    ...suffixStyle,
    color: "var(--overlay-text-muted)",
  };

  // Figma 2826:10731 "Rectangle 2" — a 1x10 rule at radius 4, white at 24%,
  // between the average and the first low. ONE rule, after the average only:
  // the frame puts nothing between "1%" and "0.1%".
  //
  // The 10 is LOCKED at every font size (Saad, 2026-08-28) — it does not track
  // fontSizeValue the way the readings do. It is a rule between two numbers,
  // not a glyph: derived from the value font it would be a stroke through the
  // whole row at 24 and an invisible speck at 8, and it has to separate a
  // value-sized number from a label-sized suffix at every step regardless.
  //
  // Colour as fill + opacity rather than a baked rgba, so it tracks
  // --overlay-text the way the frame tracks its white fill variable.
  const divider = (
    <div
      style={{
        width: 1,
        height: 10,
        flexShrink: 0,
        borderRadius: 4,
        background: "var(--overlay-text)",
        opacity: 0.24,
      }}
    />
  );
  const valueText = framerate.isEnabled && (
    <span style={valueStyle} className="tabular-nums">
      {formatValue(fpsValue)}
    </span>
  );
  // Only ever BETWEEN things. With the average hidden it would lead the pill,
  // and with both lows hidden it would trail it — in Figma it always has a
  // reading on each side. Declared after valueText, which it reads.
  const showDivider = Boolean(valueText) && (showOnePercent || showZeroPointOne);

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
        {showDivider && divider}
        {showOnePercent && lowCluster(onePercentValue, "1%")}
        {showZeroPointOne && lowCluster(zeroPointOneValue, "0.1%")}
        {showFrametime && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ position: "relative", top: -2 }}>
              <FrametimeGraph history={frametimeHistory} width={GRAPH_WIDTH} />
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
            {/* Not flex:1 any more. That existed so a "fill" graph could stretch
                to the column; at a fixed width a growing wrapper would only
                strand the graph on the left and shove "6.2 ms" to the far
                edge, which is the one thing the horizontal pill does not do. */}
            <div style={{ position: "relative", top: -2 }}>
              <FrametimeGraph history={frametimeHistory} width={GRAPH_WIDTH} />
            </div>
            {frametimeText}
          </div>
        )
      }
    >
      {valueText}
      {showDivider && divider}
      {showOnePercent && lowCluster(onePercentValue, "1%")}
      {showZeroPointOne && lowCluster(zeroPointOneValue, "0.1%")}
    </Pill>
  );
}

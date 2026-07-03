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
  const { framerate, frametime } = settings.sensors;
  if (!framerate.isEnabled && !frametime.isEnabled) return null;

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

  const fpsValue = Math.round(fpsSensor?.value ?? 0);
  const lastFrametime = frametimeHistory.length > 0 ? frametimeHistory[frametimeHistory.length - 1] : 0;
  const showFrametime = frametime.isEnabled && frametimeHistory.length > 2;

  const valueText = framerate.isEnabled && (
    <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
      {formatValue(fpsValue)}
    </span>
  );

  // Figma 2202:3261/3176/3173: "6.2 ms" is ONE text node at 12px / weight 500
  // / letterSpacing +4% / opacity 0.7 at EVERY value-font step — the whole
  // frametime reading (number included) tracks the LABEL font settings, not
  // the Stats font, and both parts are muted.
  const frametimeText = showFrametime && (
    <span className="tabular-nums" style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text-muted)", fontFamily: "Inter", letterSpacing: "0.04em" }}>
      {formatValue(lastFrametime, 1)} ms
    </span>
  );

  if (isHorizontal) {
    // Figma 2202:2664 (Frame 73): value, graph, and ms form ONE cluster with
    // 6px gaps on both sides of the graph — tighter than the pill-level 12px
    // cluster gap. The 100×7 band sits at y=9 of the 29-high row — 2px above
    // flex-center (y=11) — so nudge the centered canvas up by that constant
    // (the sweep only specifies font 24; the -2 is kept fixed across fonts).
    return (
      <Pill title="FPS" isHorizontal>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {valueText}
          {showFrametime && (
            <div style={{ position: "relative", top: -2 }}>
              <FrametimeGraph history={frametimeHistory} width={100} />
            </div>
          )}
          {frametimeText}
        </div>
      </Pill>
    );
  }

  // Figma 2202:3255 (Frame 80 + 81): the value row holds "120" and "6.2 ms"
  // at the pill's regular 12px gap, and the graph gets its own full-width
  // 24px row below (band offset 6 from the row top, per the 134×24 frame
  // wrapping a 134×7 vector).
  return (
    <Pill
      title="FPS"
      isHorizontal={false}
      graphRow={
        showFrametime && (
          <div style={{ height: 24, paddingTop: 6 }}>
            <FrametimeGraph history={frametimeHistory} width="fill" />
          </div>
        )
      }
    >
      {valueText}
      {frametimeText}
    </Pill>
  );
}

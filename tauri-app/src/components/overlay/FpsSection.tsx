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

  return (
    <Pill title="FPS" isHorizontal={isHorizontal}>
      {framerate.isEnabled && (
        <span style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text)", fontFamily: "Inter", letterSpacing: "-0.02em" }} className="tabular-nums">
          {formatValue(fpsValue)}
        </span>
      )}
      {frametime.isEnabled && frametimeHistory.length > 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Figma 2202:2313 Frame 66 wraps a 100x7 vector — fixed dimensions
              regardless of HUD size, vertically centered by the parent flex. */}
          <FrametimeGraph
            history={frametimeHistory}
            width={isHorizontal ? 100 : 80}
            height={isHorizontal ? 7 : 24}
          />
          {/* Figma 2202:2313 paints "6.2 ms" as one text node, so the value
              and unit sit closer together than the graph↔value gap (6px).
              Wrap in a sub-flex with gap-1 (4px) to match value↔unit spacing
              used everywhere else (Figma value-unit Frame, gap=4). */}
          {/* Figma 2202:2313 renders "6.2 ms" as ONE text node with node-opacity
              0.7 — both the value and the unit are muted (unlike every other
              value+unit pair in the HUD, where only the label is muted). */}
          <div className="flex items-center gap-1">
            <span className="tabular-nums" style={{ fontSize: valueFontSize, fontWeight: valueFontWeight, color: "var(--overlay-text-muted)", fontFamily: "Inter", letterSpacing: "-0.02em" }}>
              {formatValue(lastFrametime, 1)}
            </span>
            <span style={{ fontSize: labelFontSize, fontWeight: labelFontWeight, color: "var(--overlay-text-muted)", fontFamily: "Inter", letterSpacing: "0.04em" }}>ms</span>
          </div>
        </div>
      )}
    </Pill>
  );
}

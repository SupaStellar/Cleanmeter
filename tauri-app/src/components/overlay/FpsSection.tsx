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
  const { framerate, frametime } = settings.sensors;
  if (!framerate.isEnabled && !frametime.isEnabled) return null;

  // Find FPS sensor
  const fpsSensor = framerate.customReadingId
    ? findSensorById(sensors, framerate.customReadingId)
    : sensors.find(
        (s) => s.name.toLowerCase().includes("fps") || s.name.toLowerCase().includes("framerate")
      );

  const fpsValue = Math.round(fpsSensor?.value ?? 0);
  const lastFrametime = frametimeHistory.length > 0 ? frametimeHistory[frametimeHistory.length - 1] : 0;

  return (
    <Pill title="FPS" isHorizontal={isHorizontal}>
      {framerate.isEnabled && (
        <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "3em", textAlign: "right", display: "inline-block" }} className="tabular-nums">
          {formatValue(fpsValue)}
        </span>
      )}
      {frametime.isEnabled && frametimeHistory.length > 2 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FrametimeGraph
            history={frametimeHistory}
            width={isHorizontal ? 60 : 80}
            height={isHorizontal ? 20 : 24}
          />
          <span className="tabular-nums" style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "4em", textAlign: "right", display: "inline-block" }}>
            {formatValue(lastFrametime, 1)}
          </span>
          <span style={{ fontSize: labelFontSize, fontWeight: 400, color: "var(--overlay-text-muted)" }}>ms</span>
        </div>
      )}
    </Pill>
  );
}

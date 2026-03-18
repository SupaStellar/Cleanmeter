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

  const { framerate, frametime } = settings.sensors;
  if (!framerate.isEnabled && !frametime.isEnabled) return null;

  // Find FPS sensor
  const fpsSensor = framerate.customReadingId
    ? findSensorById(sensors, framerate.customReadingId)
    : sensors.find(
        (s) => s.name.toLowerCase().includes("fps") || s.name.toLowerCase().includes("framerate")
      );

  // Clamp FPS to a sane range — PresentMon can spike on single-frame anomalies
  const rawFps = fpsSensor?.value ?? 0;
  const fpsValue = rawFps > 500 ? 0 : rawFps;
  const lastFrametime = frametimeHistory.length > 0 ? frametimeHistory[frametimeHistory.length - 1] : 0;

  return (
    <Pill title="FPS" isHorizontal={isHorizontal}>
      {framerate.isEnabled && (
        <span className="text-xs font-medium text-white tabular-nums">
          {formatValue(fpsValue)}
        </span>
      )}
      {frametime.isEnabled && frametimeHistory.length > 2 && (
        <>
          <FrametimeGraph
            history={frametimeHistory}
            width={isHorizontal ? 60 : 80}
            height={isHorizontal ? 20 : 24}
          />
          <span className="text-xs text-white/60 tabular-nums">
            {formatValue(lastFrametime, 1)}ms
          </span>
        </>
      )}
    </Pill>
  );
}

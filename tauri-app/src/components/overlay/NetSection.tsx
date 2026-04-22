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
  const { downRate, upRate } = settings.sensors;
  const showNetGraph = settings.netGraph;

  const anyEnabled = downRate.isEnabled || upRate.isEnabled || showNetGraph;
  if (!anyEnabled) return null;

  const downVal = findSensorById(sensors, downRate.customReadingId)?.value ?? 0;
  const upVal = findSensorById(sensors, upRate.customReadingId)?.value ?? 0;

  return (
    <Pill title="NET" isHorizontal={isHorizontal}>
      {downRate.isEnabled && (
        <div className="flex items-center gap-1">
          {/* Download arrow */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{ opacity: Math.min(0.3 + downVal / 1000000, 1) }}
          >
            <path
              d="M5 2V8M5 8L2.5 5.5M5 8L7.5 5.5"
              stroke="var(--overlay-arrow-down)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "5.5em", textAlign: "right" }} className="tabular-nums">
            {formatNetworkRate(downVal)}
          </span>
        </div>
      )}
      {upRate.isEnabled && (
        <div className="flex items-center gap-1">
          {/* Upload arrow */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            style={{ opacity: Math.min(0.3 + upVal / 1000000, 1) }}
          >
            <path
              d="M5 8V2M5 2L2.5 4.5M5 2L7.5 4.5"
              stroke="var(--overlay-arrow-up)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span style={{ fontSize: valueFontSize, fontWeight: 400, color: "var(--overlay-text)", fontFamily: "Inter", minWidth: "5.5em", textAlign: "right" }} className="tabular-nums">
            {formatNetworkRate(upVal)}
          </span>
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

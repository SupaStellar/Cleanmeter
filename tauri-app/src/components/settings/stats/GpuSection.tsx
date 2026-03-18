import { useState } from "react";
import { tokens } from "@fluentui/react-components";
import { Settings16Regular } from "@fluentui/react-icons";
import { Checkbox } from "@/components/ui/Checkbox";
import { SensorSection } from "@/components/ui/SensorSection";
import { BoundaryInput } from "@/components/ui/BoundaryInput";
import { SensorDropdown } from "./SensorDropdown";
import { useSettingsStore } from "@/stores/settings-store";
import { SensorType } from "@/lib/types";
import type { Hardware, Sensor } from "@/lib/types";

interface GpuSectionProps {
  sensors: Sensor[];
  hardwares: Hardware[];
}

function SensorRow({
  label,
  checked,
  onToggle,
  sensorType,
  sensors,
  hardwares,
  customReadingId,
  onSensorChange,
  boundaries,
  onBoundaryChange,
  unit,
}: {
  label: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  sensorType?: SensorType;
  sensors: Sensor[];
  hardwares: Hardware[];
  customReadingId?: string;
  onSensorChange?: (v: string) => void;
  boundaries?: { low: number; medium: number; high: number };
  onBoundaryChange?: (b: { low: number; medium: number; high: number }) => void;
  unit?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = sensorType && onSensorChange;

  return (
    <>
      <div className="flex items-center justify-between">
        <Checkbox label={label} checked={checked} onChange={onToggle} />
        {checked && hasDetails && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              color: showDetails ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3,
            }}
            title="Sensor settings"
          >
            <Settings16Regular />
          </button>
        )}
      </div>
      {checked && hasDetails && showDetails && (
        <>
          <SensorDropdown
            sensorType={sensorType!}
            sensors={sensors}
            hardwares={hardwares}
            value={customReadingId ?? ""}
            onChange={onSensorChange!}
          />
          {boundaries && onBoundaryChange && unit && (
            <BoundaryInput
              boundaries={boundaries}
              onChange={onBoundaryChange}
              unit={unit}
            />
          )}
        </>
      )}
    </>
  );
}

export function GpuSection({ sensors, hardwares }: GpuSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateGraphSensor = useSettingsStore((s) => s.updateGraphSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { gpuUsage, gpuTemp, vramUsage, totalVramUsed, gpuConsumption } =
    settings.sensors;

  const anyEnabled =
    gpuUsage.isEnabled ||
    gpuTemp.isEnabled ||
    vramUsage.isEnabled ||
    totalVramUsed.isEnabled ||
    gpuConsumption.isEnabled;

  return (
    <SensorSection
      title="GPU"
      enabled={anyEnabled}
      onToggle={(enabled) => {
        updateSensor("gpuUsage", { isEnabled: enabled });
        updateSensor("gpuTemp", { isEnabled: enabled });
        updateSensor("vramUsage", { isEnabled: enabled });
        updateSensor("totalVramUsed", { isEnabled: enabled });
        updateSensor("gpuConsumption", { isEnabled: enabled });
      }}
    >
      <SensorRow
        label="GPU Usage"
        checked={gpuUsage.isEnabled}
        onToggle={(v) => updateSensor("gpuUsage", { isEnabled: v })}
        sensorType={SensorType.Load}
        sensors={sensors}
        hardwares={hardwares}
        customReadingId={gpuUsage.customReadingId}
        onSensorChange={(v) => updateGraphSensor("gpuUsage", { customReadingId: v })}
        boundaries={gpuUsage.boundaries}
        onBoundaryChange={(b) => updateBoundary("gpuUsage", b)}
        unit="%"
      />
      <SensorRow
        label="GPU Temp"
        checked={gpuTemp.isEnabled}
        onToggle={(v) => updateSensor("gpuTemp", { isEnabled: v })}
        sensorType={SensorType.Temperature}
        sensors={sensors}
        hardwares={hardwares}
        customReadingId={gpuTemp.customReadingId}
        onSensorChange={(v) => updateGraphSensor("gpuTemp", { customReadingId: v })}
        boundaries={gpuTemp.boundaries}
        onBoundaryChange={(b) => updateBoundary("gpuTemp", b)}
        unit="°"
      />
      <SensorRow
        label="VRAM Usage"
        checked={vramUsage.isEnabled}
        onToggle={(v) => updateSensor("vramUsage", { isEnabled: v })}
        sensorType={SensorType.Load}
        sensors={sensors}
        hardwares={hardwares}
        customReadingId={vramUsage.customReadingId}
        onSensorChange={(v) => updateGraphSensor("vramUsage", { customReadingId: v })}
        boundaries={vramUsage.boundaries}
        onBoundaryChange={(b) => updateBoundary("vramUsage", b)}
        unit="%"
      />
      <SensorRow
        label="Total VRAM Used"
        checked={totalVramUsed.isEnabled}
        onToggle={(v) => updateSensor("totalVramUsed", { isEnabled: v })}
        sensors={sensors}
        hardwares={hardwares}
      />
      <SensorRow
        label="GPU Power"
        checked={gpuConsumption.isEnabled}
        onToggle={(v) => updateSensor("gpuConsumption", { isEnabled: v })}
        sensors={sensors}
        hardwares={hardwares}
      />
    </SensorSection>
  );
}

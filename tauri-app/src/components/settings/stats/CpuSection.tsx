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

interface CpuSectionProps {
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

export function CpuSection({ sensors, hardwares }: CpuSectionProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateGraphSensor = useSettingsStore((s) => s.updateGraphSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { cpuUsage, cpuTemp, cpuConsumption } = settings.sensors;

  const anyEnabled =
    cpuUsage.isEnabled || cpuTemp.isEnabled || cpuConsumption.isEnabled;

  return (
    <SensorSection
      title="CPU"
      enabled={anyEnabled}
      onToggle={(enabled) => {
        updateSensor("cpuUsage", { isEnabled: enabled });
        updateSensor("cpuTemp", { isEnabled: enabled });
        updateSensor("cpuConsumption", { isEnabled: enabled });
      }}
    >
      <SensorRow
        label="CPU Usage"
        checked={cpuUsage.isEnabled}
        onToggle={(v) => updateSensor("cpuUsage", { isEnabled: v })}
        sensorType={SensorType.Load}
        sensors={sensors}
        hardwares={hardwares}
        customReadingId={cpuUsage.customReadingId}
        onSensorChange={(v) => updateGraphSensor("cpuUsage", { customReadingId: v })}
        boundaries={cpuUsage.boundaries}
        onBoundaryChange={(b) => updateBoundary("cpuUsage", b)}
        unit="%"
      />
      <SensorRow
        label="CPU Temp"
        checked={cpuTemp.isEnabled}
        onToggle={(v) => updateSensor("cpuTemp", { isEnabled: v })}
        sensorType={SensorType.Temperature}
        sensors={sensors}
        hardwares={hardwares}
        customReadingId={cpuTemp.customReadingId}
        onSensorChange={(v) => updateGraphSensor("cpuTemp", { customReadingId: v })}
        boundaries={cpuTemp.boundaries}
        onBoundaryChange={(b) => updateBoundary("cpuTemp", b)}
        unit="°"
      />
      <SensorRow
        label="CPU Power"
        checked={cpuConsumption.isEnabled}
        onToggle={(v) => updateSensor("cpuConsumption", { isEnabled: v })}
        sensors={sensors}
        hardwares={hardwares}
      />
    </SensorSection>
  );
}

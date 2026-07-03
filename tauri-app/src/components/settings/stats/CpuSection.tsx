import { useRef } from "react";
import type { Hardware, Sensor } from "@/lib/types";
import { HardwareType, SensorType } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { SectionCard, SubCollapsible } from "./SectionCard";
import { SensorSelect } from "./SensorSelect";
import { TempRangeControl } from "./TempRangeControl";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function CpuSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { cpuUsage, cpuTemp, cpuConsumption } = settings.sensors;
  const anyEnabled =
    cpuUsage.isEnabled || cpuTemp.isEnabled || cpuConsumption.isEnabled;

  const cpuHwIds = new Set(
    hardwares.filter((h) => h.hardwareType === HardwareType.Cpu).map((h) => h.identifier),
  );
  const cpuLoadSensors = sensors.filter(
    (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Load,
  );
  const cpuTempSensors = sensors.filter(
    (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Temperature,
  );
  const cpuPowerSensors = sensors.filter(
    (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Power,
  );

  const prevState = useRef<{
    cpuUsage: boolean;
    cpuTemp: boolean;
    cpuConsumption: boolean;
  } | null>(null);

  const handleMaster = (enabled: boolean) => {
    if (!enabled) {
      prevState.current = {
        cpuUsage: cpuUsage.isEnabled,
        cpuTemp: cpuTemp.isEnabled,
        cpuConsumption: cpuConsumption.isEnabled,
      };
      updateSensor("cpuUsage", { isEnabled: false });
      updateSensor("cpuTemp", { isEnabled: false });
      updateSensor("cpuConsumption", { isEnabled: false });
    } else {
      const prev = prevState.current;
      updateSensor("cpuUsage", { isEnabled: prev ? prev.cpuUsage : true });
      updateSensor("cpuTemp", { isEnabled: prev ? prev.cpuTemp : true });
      updateSensor("cpuConsumption", { isEnabled: prev ? prev.cpuConsumption : true });
    }
  };

  return (
    <SectionCard title="CPU" enabled={anyEnabled} onToggle={handleMaster}>
      <div className="flex flex-col gap-3">
        <SubCollapsible
          label="CPU Usage"
          checked={cpuUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuUsage", { isEnabled: v })}
          defaultOpen
        >
          <div className="flex flex-col gap-4">
            {cpuLoadSensors.length > 0 && (
              <SensorSelect
                label="CPU Usage"
                value={cpuUsage.customReadingId}
                options={cpuLoadSensors}
                onChange={(v) => updateSensor("cpuUsage", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={cpuUsage.boundaries}
              onChange={(b) => updateBoundary("cpuUsage", b)}
            />
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="CPU Temperature"
          checked={cpuTemp.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuTemp", { isEnabled: v })}
        >
          <div className="flex flex-col gap-4">
            {cpuTempSensors.length > 0 && (
              <SensorSelect
                label="CPU Temperature"
                value={cpuTemp.customReadingId}
                options={cpuTempSensors}
                onChange={(v) => updateSensor("cpuTemp", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={cpuTemp.boundaries}
              onChange={(b) => updateBoundary("cpuTemp", b)}
              isTemperature
              max={120}
            />
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="CPU Power"
          checked={cpuConsumption.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuConsumption", { isEnabled: v })}
        >
          <div className="flex flex-col gap-4">
            {cpuPowerSensors.length > 0 && (
              <SensorSelect
                label="CPU Power"
                value={cpuConsumption.customReadingId}
                options={cpuPowerSensors}
                onChange={(v) =>
                  updateSensor("cpuConsumption", { customReadingId: v })
                }
              />
            )}
          </div>
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}

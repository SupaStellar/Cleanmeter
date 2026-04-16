import type { Sensor, Hardware } from "@/lib/types";
import { SensorType, HardwareType } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { SectionCard, SubCollapsible } from "./SectionCard";
import { TempRangeControl } from "./TempRangeControl";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function CpuSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { cpuUsage, cpuTemp } = settings.sensors;
  const anyEnabled = cpuUsage.isEnabled || cpuTemp.isEnabled;

  const cpuHwIds = new Set(
    hardwares.filter((h) => h.hardwareType === HardwareType.Cpu).map((h) => h.identifier),
  );
  const cpuLoadSensors = sensors.filter(
    (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Load,
  );
  const cpuTempSensors = sensors.filter(
    (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Temperature,
  );

  const handleMaster = (enabled: boolean) => {
    updateSensor("cpuUsage", { isEnabled: enabled });
    updateSensor("cpuTemp", { isEnabled: enabled });
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
              <Select
                value={cpuUsage.customReadingId}
                onValueChange={(v) => updateSensor("cpuUsage", { customReadingId: v })}
              >
                <SelectTrigger className="h-10 rounded-[8px] bg-card text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-normal text-muted-foreground">Sensor:</span>
                    <SelectValue placeholder="Select" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {cpuLoadSensors.map((s) => (
                    <SelectItem key={s.identifier} value={s.identifier}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select
                value={cpuTemp.customReadingId}
                onValueChange={(v) => updateSensor("cpuTemp", { customReadingId: v })}
              >
                <SelectTrigger className="h-10 rounded-[8px] bg-card text-[14px]">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-normal text-muted-foreground">Sensor:</span>
                    <SelectValue placeholder="Select" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {cpuTempSensors.map((s) => (
                    <SelectItem key={s.identifier} value={s.identifier}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <TempRangeControl
              boundaries={cpuTemp.boundaries}
              onChange={(b) => updateBoundary("cpuTemp", b)}
            />
          </div>
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}

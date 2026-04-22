import type { Sensor, Hardware } from "@/lib/types";
import { HardwareType, SensorType } from "@/lib/types";
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

const GPU_HW_TYPES = [
  HardwareType.GpuNvidia,
  HardwareType.GpuAmd,
  HardwareType.GpuIntel,
];

export function GpuSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { gpuUsage, gpuTemp, vramUsage } = settings.sensors;

  const gpuHwIds = new Set(
    hardwares.filter((h) => GPU_HW_TYPES.includes(h.hardwareType)).map((h) => h.identifier),
  );
  const gpuLoadSensors = sensors.filter(
    (s) => gpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Load,
  );
  const gpuTempSensors = sensors.filter(
    (s) => gpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Temperature,
  );
  // VRAM usage is a load-type sensor whose name indicates memory.
  const vramSensors = sensors.filter(
    (s) =>
      gpuHwIds.has(s.hardwareIdentifier) &&
      s.sensorType === SensorType.Load &&
      s.name.toLowerCase().includes("memory"),
  );

  const anyEnabled = gpuUsage.isEnabled || gpuTemp.isEnabled || vramUsage.isEnabled;

  const handleMaster = (enabled: boolean) => {
    updateSensor("gpuUsage", { isEnabled: enabled });
    updateSensor("gpuTemp", { isEnabled: enabled });
    updateSensor("vramUsage", { isEnabled: enabled });
  };

  return (
    <SectionCard title="GPU" enabled={anyEnabled} onToggle={handleMaster}>
      <div className="flex flex-col gap-3">
        <SubCollapsible
          label="GPU Usage"
          checked={gpuUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuUsage", { isEnabled: v })}
          defaultOpen
        >
          <div className="flex flex-col gap-4">
            {gpuLoadSensors.length > 0 && (
              <SensorSelect
                value={gpuUsage.customReadingId}
                options={gpuLoadSensors}
                onChange={(v) => updateSensor("gpuUsage", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={gpuUsage.boundaries}
              onChange={(b) => updateBoundary("gpuUsage", b)}
            />
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="GPU Temperature"
          checked={gpuTemp.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuTemp", { isEnabled: v })}
        >
          <div className="flex flex-col gap-4">
            {gpuTempSensors.length > 0 && (
              <SensorSelect
                value={gpuTemp.customReadingId}
                options={gpuTempSensors}
                onChange={(v) => updateSensor("gpuTemp", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={gpuTemp.boundaries}
              onChange={(b) => updateBoundary("gpuTemp", b)}
            />
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="VRAM Usage"
          checked={vramUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("vramUsage", { isEnabled: v })}
        >
          <div className="flex flex-col gap-4">
            {vramSensors.length > 0 && (
              <SensorSelect
                value={vramUsage.customReadingId}
                options={vramSensors}
                onChange={(v) => updateSensor("vramUsage", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={vramUsage.boundaries}
              onChange={(b) => updateBoundary("vramUsage", b)}
            />
          </div>
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}

function SensorSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Sensor[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 rounded-[8px] bg-card text-[14px]">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-normal text-muted-foreground">Sensor:</span>
          <SelectValue placeholder="Select" />
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s.identifier} value={s.identifier}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

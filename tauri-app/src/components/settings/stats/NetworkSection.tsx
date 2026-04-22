import { useRef } from "react";
import { Info } from "lucide-react";
import type { Sensor, Hardware } from "@/lib/types";
import { HardwareType, SensorType } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { Checkbox } from "@/components/shadcn/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { SectionCard } from "./SectionCard";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function NetworkSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const upRate = settings.sensors.upRate;
  const downRate = settings.sensors.downRate;
  const netGraph = settings.netGraph;
  const anyEnabled = upRate.isEnabled || downRate.isEnabled || netGraph;
  const prevState = useRef<{ downRate: boolean; upRate: boolean; netGraph: boolean } | null>(null);

  const netAdapters = hardwares.filter((h) => h.hardwareType === HardwareType.Network);
  const currentAdapterId =
    getAdapterIdFromSensor(sensors, downRate.customReadingId) ??
    getAdapterIdFromSensor(sensors, upRate.customReadingId) ??
    netAdapters[0]?.identifier ??
    "";

  const selectAdapter = (adapterId: string) => {
    const adapterSensors = sensors.filter(
      (s) => s.hardwareIdentifier === adapterId && s.sensorType === SensorType.Throughput,
    );
    const down = adapterSensors.find(
      (s) =>
        s.name.toLowerCase().includes("download") || s.name.toLowerCase().includes("down"),
    );
    const up = adapterSensors.find(
      (s) => s.name.toLowerCase().includes("upload") || s.name.toLowerCase().includes("up"),
    );
    if (down) updateSensor("downRate", { customReadingId: down.identifier });
    if (up) updateSensor("upRate", { customReadingId: up.identifier });
  };

  return (
    <SectionCard
      title="Network"
      enabled={anyEnabled}
      onToggle={(enabled) => {
        if (!enabled) {
          prevState.current = { downRate: downRate.isEnabled, upRate: upRate.isEnabled, netGraph: settings.netGraph };
          updateSensor("downRate", { isEnabled: false });
          updateSensor("upRate", { isEnabled: false });
          updateSettings({ netGraph: false });
        } else {
          const prev = prevState.current;
          updateSensor("downRate", { isEnabled: prev ? prev.downRate : true });
          updateSensor("upRate", { isEnabled: prev ? prev.upRate : true });
          updateSettings({ netGraph: prev ? prev.netGraph : false });
        }
      }}
    >
      <div className="flex flex-col gap-3">
        {netAdapters.length > 0 && (
          <RadioGroup value={currentAdapterId} onValueChange={selectAdapter}>
            {netAdapters.map((h) => (
              <label
                key={h.identifier}
                className="flex cursor-pointer items-center gap-2"
              >
                <RadioGroupItem value={h.identifier} />
                <span className="text-[14px] font-medium text-foreground">{h.name}</span>
              </label>
            ))}
          </RadioGroup>
        )}

        <div className="flex flex-col gap-3 pl-6">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={downRate.isEnabled}
              onCheckedChange={(v) => updateSensor("downRate", { isEnabled: v === true })}
            />
            <span className="text-[14px] font-medium text-foreground">Receive Speed</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={upRate.isEnabled}
              onCheckedChange={(v) => updateSensor("upRate", { isEnabled: v === true })}
            />
            <span className="text-[14px] font-medium text-foreground">Send Speed</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={netGraph}
              onCheckedChange={(v) => updateSettings({ netGraph: v === true })}
            />
            <span className="text-[14px] font-medium text-foreground">Network Graph</span>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <Info className="size-4 text-muted-foreground" strokeWidth={2} />
          <span className="text-[12px] font-medium text-muted-foreground">
            Network speed is represented in Kbps
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function getAdapterIdFromSensor(sensors: Sensor[], sensorId: string): string | undefined {
  if (!sensorId) return undefined;
  return sensors.find((s) => s.identifier === sensorId)?.hardwareIdentifier;
}

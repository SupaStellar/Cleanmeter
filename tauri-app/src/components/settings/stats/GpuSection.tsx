import { useRef } from "react";
import type { Hardware, Sensor } from "@/lib/types";
import { SensorType } from "@/lib/types";
import { listGpus, sensorsOnGpu } from "@/lib/gpu";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { InfoIcon } from "../settings/icons";
import { SectionCard, SubCollapsible } from "./SectionCard";
import { SensorSelect } from "./SensorSelect";
import { TempRangeControl } from "./TempRangeControl";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function GpuSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const selectGpu = useSettingsStore((s) => s.selectGpu);
  // `.settled` rather than a per-snapshot check: one snapshot cannot tell a
  // parked GPU from one whose sensors have not activated yet, and the notice
  // would flash on every launch. See nextGpuSilence.
  const gpuIsIdle = useSettingsStore((s) => s.gpuSilence.settled);
  const { gpuUsage, gpuTemp, gpuConsumption, vramUsage } = settings.sensors;

  const gpus = listGpus(hardwares);
  // Every row below draws from one GPU. Scoping the option lists is what makes
  // a mixed configuration unreachable rather than merely discouraged: on a
  // laptop the sensor names collide (both an NVIDIA and an Intel GPU expose a
  // temperature called "GPU Core"), so an unscoped list offers two identical
  // rows and no way to tell them apart.
  const gpuSensors = sensorsOnGpu(sensors, settings.selectedGpuId);

  const gpuLoadSensors = gpuSensors.filter((s) => s.sensorType === SensorType.Load);
  const gpuTempSensors = gpuSensors.filter((s) => s.sensorType === SensorType.Temperature);
  const gpuPowerSensors = gpuSensors.filter((s) => s.sensorType === SensorType.Power);
  // VRAM usage is a load-type sensor whose name indicates memory.
  const vramSensors = gpuLoadSensors.filter((s) =>
    s.name.toLowerCase().includes("memory"),
  );

  const anyEnabled =
    gpuUsage.isEnabled ||
    gpuTemp.isEnabled ||
    gpuConsumption.isEnabled ||
    vramUsage.isEnabled;

  const prevState = useRef<{
    gpuUsage: boolean;
    gpuTemp: boolean;
    gpuConsumption: boolean;
    vramUsage: boolean;
  } | null>(null);

  const handleMaster = (enabled: boolean) => {
    if (!enabled) {
      prevState.current = {
        gpuUsage: gpuUsage.isEnabled,
        gpuTemp: gpuTemp.isEnabled,
        gpuConsumption: gpuConsumption.isEnabled,
        vramUsage: vramUsage.isEnabled,
      };
      updateSensor("gpuUsage", { isEnabled: false });
      updateSensor("gpuTemp", { isEnabled: false });
      updateSensor("gpuConsumption", { isEnabled: false });
      updateSensor("vramUsage", { isEnabled: false });
      // totalVramUsed (the VRAM GB reading) rides along with vramUsage so the
      // overlay's GB cluster stays in sync — they're one "VRAM" control.
      updateSensor("totalVramUsed", { isEnabled: false });
    } else {
      const prev = prevState.current;
      updateSensor("gpuUsage", { isEnabled: prev ? prev.gpuUsage : true });
      updateSensor("gpuTemp", { isEnabled: prev ? prev.gpuTemp : true });
      updateSensor("gpuConsumption", { isEnabled: prev ? prev.gpuConsumption : true });
      updateSensor("vramUsage", { isEnabled: prev ? prev.vramUsage : true });
      updateSensor("totalVramUsed", { isEnabled: prev ? prev.vramUsage : true });
    }
  };

  return (
    <SectionCard title="GPU" enabled={anyEnabled} onToggle={handleMaster}>
      <div className="flex flex-col gap-3">
        {/* Only shown when there is a choice to make. On the overwhelming
            majority of machines there is exactly one GPU, and a control whose
            list has a single entry is noise. */}
        {gpus.length > 1 && (
          <div className="flex flex-col gap-3">
            <Select value={settings.selectedGpuId} onValueChange={selectGpu}>
              <SelectTrigger className="w-full rounded-[8px] border-[var(--borderBolder)] bg-[var(--bgSurfaceRaised)] font-medium shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gpus.map((gpu) => (
                  <SelectItem key={gpu.identifier} value={gpu.identifier}>
                    {gpu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Only while the chosen GPU is actually reporting nothing. A GPU
                that is reading fine needs no explanation, and a notice that is
                always there stops being read. */}
            {gpuIsIdle && (
              <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                <InfoIcon className="size-4 shrink-0" />
                <span>A GPU that is idle or powered down reports 0.</span>
              </div>
            )}
          </div>
        )}

        <SubCollapsible
          label="GPU Usage"
          checked={gpuUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuUsage", { isEnabled: v })}
          defaultOpen
        >
          <div className="flex flex-col gap-4">
            {gpuLoadSensors.length > 0 && (
              <SensorSelect
                label="GPU Usage"
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
                label="GPU Temperature"
                value={gpuTemp.customReadingId}
                options={gpuTempSensors}
                onChange={(v) => updateSensor("gpuTemp", { customReadingId: v })}
              />
            )}
            <TempRangeControl
              boundaries={gpuTemp.boundaries}
              onChange={(b) => updateBoundary("gpuTemp", b)}
              isTemperature
              max={120}
            />
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="GPU Power"
          checked={gpuConsumption.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuConsumption", { isEnabled: v })}
        >
          <div className="flex flex-col gap-4">
            {gpuPowerSensors.length > 0 && (
              <SensorSelect
                label="GPU Power"
                value={gpuConsumption.customReadingId}
                options={gpuPowerSensors}
                onChange={(v) => updateSensor("gpuConsumption", { customReadingId: v })}
              />
            )}
          </div>
        </SubCollapsible>

        <SubCollapsible
          label="VRAM Usage"
          checked={vramUsage.isEnabled}
          onCheckedChange={(v) => {
            updateSensor("vramUsage", { isEnabled: v });
            updateSensor("totalVramUsed", { isEnabled: v });
          }}
        >
          <div className="flex flex-col gap-4">
            {vramSensors.length > 0 && (
              <SensorSelect
                label="VRAM Usage"
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


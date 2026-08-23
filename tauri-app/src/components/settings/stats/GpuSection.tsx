import { useRef } from "react";
import type { Hardware, Sensor } from "@/lib/types";
import { SensorType } from "@/lib/types";
import { listGpus, sensorsOnGpu } from "@/lib/gpu";
import { sensorReadingIds, sensorReadingPatch } from "@/lib/sensor-readings";
import { useSettingsStore } from "@/stores/settings-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
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
      {/* Two blocks, not one: the card lays its children out 20 apart, which is
          the gap Figma puts between the GPU picker and the sensor rows, while
          the rows themselves sit 12 apart inside their own block. */}
      {/* The picker is only shown when there is a choice to make. On the
          overwhelming majority of machines there is exactly one GPU, and a
          control whose list has a single entry is noise; that machine sees the
          card exactly as it was before the picker existed. */}
      {gpus.length > 1 && (
        <>
          <div className="flex flex-col gap-[var(--spacingS)]">
            <Select value={settings.selectedGpuId} onValueChange={selectGpu}>
              <SelectFieldTrigger label="Selected GPU:">
                <SelectValue />
              </SelectFieldTrigger>
              <SelectContent>
                {gpus.map((gpu) => (
                  <SelectItem key={gpu.identifier} value={gpu.identifier}>
                    {gpu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Shown for as long as the picker is, per Figma. It explains what
                a 0 reading means rather than reporting one, so it is a standing
                note about the control and not a state of the GPU. */}
            <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
              <InfoIcon className="size-[16px] shrink-0" />
              <span>A GPU will report stats only when it’s being used.</span>
            </div>
          </div>
          <div className="h-px w-full shrink-0 bg-[var(--borderSubtle)]" />
        </>
      )}

      <div className="flex flex-col gap-[var(--spacingS)]">
        <SubCollapsible
          label="GPU Usage"
          checked={gpuUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuUsage", { isEnabled: v })}
          defaultOpen
        >
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
        </SubCollapsible>

        <SubCollapsible
          label="GPU Temperature"
          checked={gpuTemp.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuTemp", { isEnabled: v })}
        >
          {gpuTempSensors.length > 0 && (
            <SensorSelect
              label="GPU Temperature"
              multiple
              values={sensorReadingIds(gpuTemp)}
              options={gpuTempSensors}
              onChange={(values) => updateSensor("gpuTemp", sensorReadingPatch(values))}
            />
          )}
          <TempRangeControl
            boundaries={gpuTemp.boundaries}
            onChange={(b) => updateBoundary("gpuTemp", b)}
            isTemperature
            max={120}
          />
        </SubCollapsible>

        <SubCollapsible
          label="GPU Power"
          checked={gpuConsumption.isEnabled}
          onCheckedChange={(v) => updateSensor("gpuConsumption", { isEnabled: v })}
        >
          {gpuPowerSensors.length > 0 && (
            <SensorSelect
              label="GPU Power"
              value={gpuConsumption.customReadingId}
              options={gpuPowerSensors}
              onChange={(v) => updateSensor("gpuConsumption", { customReadingId: v })}
            />
          )}
        </SubCollapsible>

        <SubCollapsible
          label="VRAM Usage"
          checked={vramUsage.isEnabled}
          onCheckedChange={(v) => {
            updateSensor("vramUsage", { isEnabled: v });
            updateSensor("totalVramUsed", { isEnabled: v });
          }}
        >
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
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}


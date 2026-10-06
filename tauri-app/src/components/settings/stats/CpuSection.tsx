import { useRef } from "react";
import type { Hardware, Sensor } from "@/lib/types";
import { HardwareType, SensorType } from "@/lib/types";
import { cpuClockOptions } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { InfoIcon } from "../settings/icons";
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
  const { cpuUsage, cpuTemp, cpuConsumption, cpuClock } = settings.sensors;
  const anyEnabled =
    cpuUsage.isEnabled || cpuTemp.isEnabled || cpuConsumption.isEnabled || cpuClock.isEnabled;

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

  const cpuClockSensors = cpuClockOptions(
    sensors.filter(
      (s) => cpuHwIds.has(s.hardwareIdentifier) && s.sensorType === SensorType.Clock,
    ),
    cpuClock.customReadingId,
  );

  // Before the first frame, or while the sidecar is down, there are no CPU
  // sensors at all; only a CPU that reports other readings but no clock has
  // earned the "doesn't report" line.
  const cpuReporting = sensors.some((s) => cpuHwIds.has(s.hardwareIdentifier));

  const prevState = useRef<{
    cpuUsage: boolean;
    cpuTemp: boolean;
    cpuConsumption: boolean;
    cpuClock: boolean;
  } | null>(null);

  const handleMaster = (enabled: boolean) => {
    if (!enabled) {
      prevState.current = {
        cpuUsage: cpuUsage.isEnabled,
        cpuTemp: cpuTemp.isEnabled,
        cpuConsumption: cpuConsumption.isEnabled,
        cpuClock: cpuClock.isEnabled,
      };
      updateSensor("cpuUsage", { isEnabled: false });
      updateSensor("cpuTemp", { isEnabled: false });
      updateSensor("cpuConsumption", { isEnabled: false });
      updateSensor("cpuClock", { isEnabled: false });
    } else {
      const prev = prevState.current;
      updateSensor("cpuUsage", { isEnabled: prev ? prev.cpuUsage : true });
      updateSensor("cpuTemp", { isEnabled: prev ? prev.cpuTemp : true });
      updateSensor("cpuConsumption", { isEnabled: prev ? prev.cpuConsumption : true });
      updateSensor("cpuClock", { isEnabled: prev ? prev.cpuClock : false });
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
        </SubCollapsible>

        <SubCollapsible
          label="CPU Temperature"
          checked={cpuTemp.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuTemp", { isEnabled: v })}
        >
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
        </SubCollapsible>

        <SubCollapsible
          label="CPU Power"
          checked={cpuConsumption.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuConsumption", { isEnabled: v })}
        >
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
        </SubCollapsible>
        <SubCollapsible
          label="CPU Clock"
          checked={cpuClock.isEnabled}
          onCheckedChange={(v) => updateSensor("cpuClock", { isEnabled: v })}
        >
          <div className="flex flex-col gap-[var(--spacingS)]">
            {cpuClockSensors.length > 0 && (
              <SensorSelect
                label="CPU Clock"
                value={cpuClock.customReadingId}
                options={cpuClockSensors}
                onChange={(v) => updateSensor("cpuClock", { customReadingId: v })}
              />
            )}
            <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
              <InfoIcon className="size-[16px] shrink-0" />
              <span>
                {cpuClockSensors.length === 0 && cpuReporting
                  ? "This CPU doesn't report clock speed."
                  : "Clock speed drops when idle and rises under load."}
              </span>
            </div>
          </div>
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}

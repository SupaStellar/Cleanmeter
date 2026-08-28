import { useRef } from "react";
import type { Sensor, Hardware } from "@/lib/types";
import { HardwareType, SensorType } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
import { InfoIcon } from "../settings/icons";
import { SectionCard } from "./SectionCard";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function NetworkSection({ sensors, hardwares }: Props) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const upRate = settings.sensors.upRate;
  const downRate = settings.sensors.downRate;
  const anyEnabled = upRate.isEnabled || downRate.isEnabled;
  const prevState = useRef<{ downRate: boolean; upRate: boolean } | null>(null);

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
          prevState.current = { downRate: downRate.isEnabled, upRate: upRate.isEnabled };
          updateSensor("downRate", { isEnabled: false });
          updateSensor("upRate", { isEnabled: false });
        } else {
          const prev = prevState.current;
          updateSensor("downRate", { isEnabled: prev ? prev.downRate : true });
          updateSensor("upRate", { isEnabled: prev ? prev.upRate : true });
        }
      }}
    >
      {/* Figma 2790:1892: the adapter list is a labelled field, not a radio
          column — the same "Input" the GPU and monitor pickers use, so an
          adapter name that runs to 440px truncates in a 40px row instead of
          setting the card's width. Its "Kbps" note sits directly under it
          (2804:5976), a 1px Border/Subtle divider (2804:5974) follows, and
          the speed checkboxes come after that at gap 12. */}
      <div className="flex flex-col gap-[var(--spacingS)]">
        <Select value={currentAdapterId} onValueChange={selectAdapter}>
          <SelectFieldTrigger label="Selected:" disabled={netAdapters.length === 0}>
            <SelectValue placeholder="No network adapter detected" />
          </SelectFieldTrigger>
          <SelectContent>
            {netAdapters.map((h) => (
              <SelectItem key={h.identifier} value={h.identifier}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-[var(--spacingXxxs)] text-[12px] font-medium leading-[15px] text-[var(--textParagraph1)]">
          <InfoIcon className="size-[16px] shrink-0" />
          <span>Network speed is represented in Kbps</span>
        </div>
      </div>

      <div className="h-px w-full bg-[var(--borderSubtle)]" />

      <div className="flex flex-col gap-[var(--spacingS)]">
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
      </div>
    </SectionCard>
  );
}

function getAdapterIdFromSensor(sensors: Sensor[], sensorId: string): string | undefined {
  if (!sensorId) return undefined;
  return sensors.find((s) => s.identifier === sensorId)?.hardwareIdentifier;
}

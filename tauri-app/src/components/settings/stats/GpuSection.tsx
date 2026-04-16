import type { Sensor, Hardware } from "@/lib/types";
import { useSettingsStore } from "@/stores/settings-store";
import { SectionCard, SubCollapsible } from "./SectionCard";
import { TempRangeControl } from "./TempRangeControl";

interface Props {
  sensors: Sensor[];
  hardwares: Hardware[];
}

export function GpuSection({ sensors: _sensors, hardwares: _hardwares }: Props) {
  void _sensors;
  void _hardwares;
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { gpuUsage, gpuTemp, vramUsage } = settings.sensors;

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
          <TempRangeControl
            boundaries={gpuTemp.boundaries}
            onChange={(b) => updateBoundary("gpuTemp", b)}
          />
        </SubCollapsible>

        <SubCollapsible
          label="VRAM Usage"
          checked={vramUsage.isEnabled}
          onCheckedChange={(v) => updateSensor("vramUsage", { isEnabled: v })}
        >
          <TempRangeControl
            boundaries={vramUsage.boundaries}
            onChange={(b) => updateBoundary("vramUsage", b)}
          />
        </SubCollapsible>
      </div>
    </SectionCard>
  );
}

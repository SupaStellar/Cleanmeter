import { useSettingsStore } from "@/stores/settings-store";
import { HotkeyBar } from "./HotkeyBar";
import { FpsSection } from "./FpsSection";
import { GpuSection } from "./GpuSection";
import { CpuSection } from "./CpuSection";
import { RamSection } from "./RamSection";
import { NetworkSection } from "./NetworkSection";
import { MonitorSection } from "./MonitorSection";

export function StatsTab() {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];
  const hardwares = sensorData?.hardwares ?? [];

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <HotkeyBar />
      <FpsSection />
      <GpuSection sensors={sensors} hardwares={hardwares} />
      <CpuSection sensors={sensors} hardwares={hardwares} />
      <RamSection />
      <NetworkSection sensors={sensors} hardwares={hardwares} />
      <MonitorSection />
    </div>
  );
}

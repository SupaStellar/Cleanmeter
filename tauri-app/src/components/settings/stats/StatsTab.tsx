import {
  MessageBar,
  MessageBarBody,
  Caption1,
  tokens,
} from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { useSettingsStore } from "@/stores/settings-store";
import { FpsSection } from "./FpsSection";
import { GpuSection } from "./GpuSection";
import { CpuSection } from "./CpuSection";
import { RamSection } from "./RamSection";
import { NetworkSection } from "./NetworkSection";

export function StatsTab() {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];
  const hardwares = sensorData?.hardwares ?? [];

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ padding: 16, gap: 16 }}>
      <div
        className="flex items-center gap-2"
        style={{
          padding: "10px 14px",
          borderRadius: 6,
          background: tokens.colorNeutralBackground1,
          border: `1px solid ${tokens.colorNeutralStroke2}`,
        }}
      >
        <Info16Regular style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} />
        <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
          Press <Kbd>Ctrl</Kbd> + <Kbd>F10</Kbd> to toggle the overlay
        </Caption1>
      </div>

      <FpsSection />
      <GpuSection sensors={sensors} hardwares={hardwares} />
      <CpuSection sensors={sensors} hardwares={hardwares} />
      <RamSection />
      <NetworkSection sensors={sensors} hardwares={hardwares} />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 6px",
        borderRadius: 4,
        background: tokens.colorNeutralBackground3,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "inherit",
        color: tokens.colorNeutralForeground1,
      }}
    >
      {children}
    </kbd>
  );
}

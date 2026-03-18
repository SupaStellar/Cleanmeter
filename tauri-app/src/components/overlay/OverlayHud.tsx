import { useSettingsStore } from "@/stores/settings-store";
import { FpsSection } from "./FpsSection";
import { GpuSection } from "./GpuSection";
import { CpuSection } from "./CpuSection";
import { RamSection } from "./RamSection";
import { NetSection } from "./NetSection";

export function OverlayHud() {
  const settings = useSettingsStore((s) => s.settings);
  const isHorizontal = settings.isHorizontal;

  return (
    <div
      data-tauri-drag-region
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        opacity: settings.opacity,
        border: "1px solid rgba(255,255,255,0.08)",
        ...(isHorizontal
          ? {
              flexDirection: "row" as const,
              alignItems: "center",
              width: "fit-content",
              borderRadius: 9999,
              background: "rgba(30,30,30,0.7)",
            }
          : {
              flexDirection: "column" as const,
              borderRadius: 12,
              background: "rgba(30,30,30,0.7)",
              width: "100%",
            }),
      }}
    >
      <FpsSection isHorizontal={isHorizontal} />
      <GpuSection isHorizontal={isHorizontal} />
      <CpuSection isHorizontal={isHorizontal} />
      <RamSection isHorizontal={isHorizontal} />
      <NetSection isHorizontal={isHorizontal} />
    </div>
  );
}

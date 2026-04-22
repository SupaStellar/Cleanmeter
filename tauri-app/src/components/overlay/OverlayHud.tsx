import { useSettingsStore } from "@/stores/settings-store";
import { FpsSection } from "./FpsSection";
import { GpuSection } from "./GpuSection";
import { CpuSection } from "./CpuSection";
import { RamSection } from "./RamSection";
import { NetSection } from "./NetSection";

export function OverlayHud() {
  const settings = useSettingsStore((s) => s.settings);
  const isHorizontal = settings.isHorizontal;
  const dark = !settings.isMeterLight;
  const bg = dark ? "rgba(30,30,30,0.7)" : "rgba(255,255,255,0.7)";
  const border = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)";

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        opacity: settings.opacity,
        border,
        "--overlay-text": dark ? "#fff" : "#000",
        "--overlay-text-muted": dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
        "--overlay-track": dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
        "--overlay-arrow-down": dark ? "#22d3ee" : "#0891b2",
        "--overlay-arrow-up": dark ? "#a78bfa" : "#6d28d9",
        ...(isHorizontal
          ? {
              flexDirection: "row" as const,
              alignItems: "center",
              width: "fit-content",
              borderRadius: 9999,
              background: bg,
            }
          : {
              flexDirection: "column" as const,
              borderRadius: 12,
              background: bg,
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

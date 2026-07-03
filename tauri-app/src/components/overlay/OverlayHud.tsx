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
  // Pre-PR#8 background: fixed 0.7 outer + 1px border. PR#8 had tied the outer
  // to pillOpacity (pure black, no border); reverted to the prior look on request.
  const bg = dark ? "rgba(30,30,30,0.7)" : "rgba(255,255,255,0.7)";
  const border = dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)";

  return (
    <div
      style={{
        display: "flex",
        // Figma horizontal (2106:2313) and vertical (2169:286) both use
        // outer pad 4 / inter-pill gap 4.
        gap: 4,
        padding: 4,
        border,
        // Body sets line-height:20px globally which clamps text height to 20px
        // regardless of fontSize, so the pill stopped growing past the 32px
        // Figma frame. Unitless 1.2 = Inter's natural line-height — exact
        // match for Figma's 24x15 (label@12) and 41x29 (value@24) text bboxes.
        lineHeight: 1.2,
        "--overlay-text": dark ? "#fff" : "#000",
        "--overlay-text-muted": dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
        // Track (ring + bar) is 10% per Figma — 2106:2313 Ellipse 2 and the
        // 2527:10167 bar swatches both carry node opacity 0.1.
        "--overlay-track": dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        "--overlay-arrow-down": dark ? "#22d3ee" : "#0891b2",
        "--overlay-arrow-up": dark ? "#a78bfa" : "#6d28d9",
        ...(isHorizontal
          ? {
              flexDirection: "row" as const,
              // alignItems "stretch" matches Figma's auto-layout where every
              // sub-pill takes the inner row height (24 at smallest, 37 at
              // largest). Without this, ring-less pills (FPS, NET) sit
              // shorter than ring-bearing ones (CPU, GPU, RAM).
              alignItems: "stretch",
              width: "fit-content",
              borderRadius: 9999,
              background: bg,
            }
          : {
              // Figma 2169:286 vertical outer: r=12, bg same, no border.
              // Sub-pills stack vertically with gap 4; each sub-pill is still
              // horizontal-flex internally (label-left, value-right).
              flexDirection: "column" as const,
              alignItems: "stretch",
              width: "fit-content",
              borderRadius: 12,
              background: bg,
            }),
      }}
    >
      <FpsSection isHorizontal={isHorizontal} />
      <CpuSection isHorizontal={isHorizontal} />
      <GpuSection isHorizontal={isHorizontal} />
      <RamSection isHorizontal={isHorizontal} />
      <NetSection isHorizontal={isHorizontal} />
    </div>
  );
}

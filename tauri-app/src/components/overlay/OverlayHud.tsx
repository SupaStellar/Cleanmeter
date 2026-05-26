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
  const pillOpacity = settings.pillOpacity ?? 0.3;
  // Figma 2106:2313 outer capsule: bg rgba(0,0,0,0.64), sub-pills at 0.24.
  // Tie the outer opacity to the existing pillOpacity slider via the same
  // ratio so moving the slider fades both layers together. At Figma-canonical
  // pillOpacity=0.24 the outer lands at 0.64; capped at 1.0 so high
  // pillOpacity values don't blow past fully-opaque.
  const outerOpacity = Math.min(1, pillOpacity * (0.64 / 0.24));
  const bg = dark
    ? `rgba(0,0,0,${outerOpacity})`
    : `rgba(255,255,255,${outerOpacity})`;

  return (
    <div
      style={{
        display: "flex",
        // Figma horizontal (2106:2313) and vertical (2169:286) both use
        // outer pad 4 / inter-pill gap 4.
        gap: 4,
        padding: 4,
        opacity: settings.opacity,
        // Body sets line-height:20px globally which clamps text height to 20px
        // regardless of fontSize, so the pill stopped growing past the 32px
        // Figma frame. Unitless 1.2 = Inter's natural line-height — exact
        // match for Figma's 24x15 (label@12) and 41x29 (value@24) text bboxes.
        lineHeight: 1.2,
        "--overlay-text": dark ? "#fff" : "#000",
        "--overlay-text-muted": dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)",
        "--overlay-track": dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
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

import { useSettingsStore } from "@/stores/settings-store";

interface PillProps {
  title: string;
  isHorizontal: boolean;
  children: React.ReactNode;
  tooltip?: string;
}

export function Pill({ title, isHorizontal, children, tooltip }: PillProps) {
  const pillOpacity = useSettingsStore((s) => s.settings.pillOpacity ?? 0.3);
  const labelSize = useSettingsStore((s) => s.settings.fontSizeLabel ?? 12);
  const valueFontSize = useSettingsStore((s) => s.settings.fontSizeValue ?? 12);
  const dark = useSettingsStore((s) => !s.settings.isMeterLight);

  const pillBg = dark ? `rgba(0,0,0,${pillOpacity})` : `rgba(255,255,255,${pillOpacity})`;
  // Figma labels (FPS/CPU/GPU/RAM/NET text nodes) have node-level opacity 0.7
  // while their white fill stays at opacity 1. CSS rgba(255,255,255,0.7)
  // renders identically. Values, units, and arrows stay full white.
  const labelColor = "var(--overlay-text-muted)";
  // Figma's auto-layout produces uniform sub-pill heights even when one pill
  // has no ring (FPS, NET). Force a floor of ring + vertical-pad so ring-less
  // pills don't sit shorter than ring-bearing ones, matching the Figma sweep
  // (24/37 horizontal, 32/45 vertical).
  const ringSize = valueFontSize <= 14 ? 16 : 20;
  const minHeight = ringSize + (isHorizontal ? 8 : 16);
  // Figma vertical (2169:286) pins every 3-char label to a uniform width so
  // values align across stacked sub-pills. Figma reports 28px @ fontSizeLabel
  // 12, but in CSS Inter "RAM" renders at 28.2px (rounding to 29) — wider
  // than FPS/GPU/CPU/NET. Use a fixed width slightly larger than RAM's
  // natural so every label slot is identical and value clusters start at
  // the exact same x. Horizontal lets labels hug their text since pills
  // sit side-by-side.
  const labelWidth = isHorizontal ? undefined : Math.ceil(labelSize * 2.5);
  // Figma TEXT nodes have letterSpacing +4% on labels/units/arrows, -2% on
  // values. Applied here for labels.
  const labelStyle: React.CSSProperties = {
    fontSize: labelSize,
    fontWeight: 500,
    color: labelColor,
    fontFamily: "Inter",
    letterSpacing: "0.04em",
    display: "inline-block",
    width: labelWidth,
    flexShrink: 0,
  };

  if (isHorizontal) {
    // Figma 2106:2313 sub-pill spec: r=100, bg rgba(0,0,0,0.24), pad 4/12/4/12,
    // gap 12 uniform between label AND between every metric cluster (e.g. GPU
    // has temp/load/vram clusters all spaced at 12). minHeight removed so the
    // pill hugs its tallest child — height grows with fontSizeValue exactly
    // as the 7-size Figma sweep illustrates (24→37 inner row height).
    return (
      <div
        title={tooltip}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: pillBg,
          borderRadius: 9999,
          padding: "4px 12px",
          flexShrink: 0,
          whiteSpace: "nowrap",
          minHeight,
        }}
      >
        <span style={labelStyle}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>{children}</div>
      </div>
    );
  }

  // Figma 2169:286 vertical sub-pill: r=8, bg rgba(0,0,0,0.24), pad 8/12/8/12,
  // gap 12 between label and value-cluster. Internally HORIZONTAL — same row
  // structure as the horizontal HUD, just rounder vertical padding so stacked
  // pills sit comfortably one above the other.
  return (
    <div
      title={tooltip}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: pillBg,
        borderRadius: 8,
        padding: "8px 12px",
        flexShrink: 0,
        whiteSpace: "nowrap",
        minHeight,
      }}
    >
      <span style={labelStyle}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

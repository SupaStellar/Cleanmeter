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
  const dark = useSettingsStore((s) => !s.settings.isMeterLight);

  const pillBg = dark ? `rgba(0,0,0,${pillOpacity})` : `rgba(255,255,255,${pillOpacity})`;
  const labelColor = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";

  if (isHorizontal) {
    return (
      <div
        title={tooltip}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: pillBg,
          borderRadius: 9999,
          padding: "4px 12px",
          minHeight: 32,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: labelSize, fontWeight: 500, color: labelColor }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{children}</div>
      </div>
    );
  }

  return (
    <div
      title={tooltip}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: pillBg,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: labelSize, fontWeight: 500, color: labelColor }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

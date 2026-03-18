import { useSettingsStore } from "@/stores/settings-store";

interface PillProps {
  title: string;
  isHorizontal: boolean;
  children: React.ReactNode;
}

export function Pill({ title, isHorizontal, children }: PillProps) {
  const pillOpacity = useSettingsStore((s) => s.settings.pillOpacity ?? 0.3);

  if (isHorizontal) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: `rgba(0,0,0,${pillOpacity})`,
          borderRadius: 9999,
          padding: "4px 12px",
          minHeight: 32,
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{children}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: `rgba(0,0,0,${pillOpacity})`,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

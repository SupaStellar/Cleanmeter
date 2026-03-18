import { useEffect, useState } from "react";
import { Body1Strong, tokens } from "@fluentui/react-components";
import { Select } from "@/components/ui/Select";
import { useSettingsStore } from "@/stores/settings-store";
import { getMonitors } from "@/lib/tauri";
import type { MonitorInfo } from "@/lib/types";

export function MonitorSelect() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    getMonitors().then(setMonitors).catch(() => {});
  }, []);

  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "16px 20px",
      }}
    >
      <Body1Strong style={{ display: "block", marginBottom: 12 }}>Monitor</Body1Strong>
      <Select
        value={String(settings.selectedDisplayIndex)}
        options={monitors.map((m, i) => ({
          value: String(i),
          label: m.name + (m.primary ? " (Primary)" : ""),
        }))}
        onChange={(v) => updateSettings({ selectedDisplayIndex: parseInt(v) })}
        placeholder="Select monitor..."
      />
    </div>
  );
}

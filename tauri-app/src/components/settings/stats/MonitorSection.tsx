import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useSettingsStore } from "@/stores/settings-store";
import { getMonitors } from "@/lib/tauri";
import type { MonitorInfo } from "@/lib/types";
import { SectionCard } from "./SectionCard";

export function MonitorSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    getMonitors().then((m) => {
      if (m) setMonitors(m);
    }).catch(() => {});
  }, []);

  return (
    <SectionCard title="Monitor">
      <Select
        value={String(settings.selectedDisplayIndex)}
        onValueChange={(v) => updateSettings({ selectedDisplayIndex: parseInt(v, 10) })}
      >
        <SelectTrigger className="h-10 rounded-[8px] text-[14px]">
          <SelectValue
            placeholder={monitors[settings.selectedDisplayIndex]?.name ?? "Select monitor"}
          />
        </SelectTrigger>
        <SelectContent>
          {monitors.map((m, i) => (
            <SelectItem key={i} value={String(i)}>
              {m.name}
              {m.primary ? " (Primary)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SectionCard>
  );
}

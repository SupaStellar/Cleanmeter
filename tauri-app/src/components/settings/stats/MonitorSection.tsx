import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/shadcn/select";
import { SelectFieldTrigger } from "@/components/ui/SelectField";
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
        {/* Figma 2804:6116: the same labelled "Input" the other pickers use,
            so the monitor name reads as the value of "Selected:" rather than
            as a bare string in a box. */}
        <SelectFieldTrigger label="Selected:">
          <SelectValue
            placeholder={monitors[settings.selectedDisplayIndex]?.name ?? "Select monitor"}
          />
        </SelectFieldTrigger>
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

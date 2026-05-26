import { useSettingsStore } from "@/stores/settings-store";
import { SectionCard, SubCollapsible } from "./SectionCard";
import { TempRangeControl } from "./TempRangeControl";

export function RamSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSensor = useSettingsStore((s) => s.updateSensor);
  const updateBoundary = useSettingsStore((s) => s.updateBoundary);
  const { ramUsage } = settings.sensors;
  // RAM Usage has no sensor selector to fall back on, so when graphs are
  // disabled the expanded row would be empty — render the row flat instead.
  const graphEnabled = settings.progressType !== "none";

  return (
    <SectionCard
      title="RAM"
      enabled={ramUsage.isEnabled}
      onToggle={(v) => updateSensor("ramUsage", { isEnabled: v })}
    >
      <SubCollapsible
        label="RAM Usage"
        checked={ramUsage.isEnabled}
        onCheckedChange={(v) => updateSensor("ramUsage", { isEnabled: v })}
        expandable={graphEnabled}
      >
        <TempRangeControl
          boundaries={ramUsage.boundaries}
          onChange={(b) => updateBoundary("ramUsage", b)}
        />
      </SubCollapsible>
    </SectionCard>
  );
}

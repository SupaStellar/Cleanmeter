import { Caption1, tokens } from "@fluentui/react-components";
import { Collapsible } from "@/components/ui/Collapsible";
import { Slider } from "@/components/ui/Slider";
import { useSettingsStore } from "@/stores/settings-store";

export function OpacitySlider() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "12px 20px",
      }}
    >
      <Collapsible title="Opacity">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <Caption1 style={{ fontWeight: 600 }}>Overall</Caption1>
              <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>
                {Math.round(settings.opacity * 100)}%
              </Caption1>
            </div>
            <Slider
              value={settings.opacity}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => updateSettings({ opacity: v })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <Caption1 style={{ fontWeight: 600 }}>Metric pills</Caption1>
              <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>
                {Math.round(settings.pillOpacity * 100)}%
              </Caption1>
            </div>
            <Slider
              value={settings.pillOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateSettings({ pillOpacity: v })}
            />
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

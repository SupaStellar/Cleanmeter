import { tokens } from "@fluentui/react-components";
import { Collapsible } from "@/components/ui/Collapsible";
import { StyleCard } from "@/components/ui/StyleCard";
import { useSettingsStore } from "@/stores/settings-store";

export function OrientationPicker() {
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
      <Collapsible title="Orientation">
        <div className="flex gap-3">
          <StyleCard
            selected={settings.isHorizontal}
            onClick={() => updateSettings({ isHorizontal: true })}
            label="Horizontal"
          >
            <div
              style={{
                width: "75%",
                height: 8,
                borderRadius: 4,
                backgroundColor: tokens.colorBrandBackground,
                opacity: 0.6,
              }}
            />
          </StyleCard>
          <StyleCard
            selected={!settings.isHorizontal}
            onClick={() => updateSettings({ isHorizontal: false })}
            label="Vertical"
          >
            <div
              style={{
                width: 8,
                height: "75%",
                borderRadius: 4,
                backgroundColor: tokens.colorBrandBackground,
                opacity: 0.6,
              }}
            />
          </StyleCard>
        </div>
      </Collapsible>
    </div>
  );
}

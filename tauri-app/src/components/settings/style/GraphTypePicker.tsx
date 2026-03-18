import { Body1Strong, tokens } from "@fluentui/react-components";
import { StyleCard } from "@/components/ui/StyleCard";
import { Switch } from "@/components/ui/Switch";
import { useSettingsStore } from "@/stores/settings-store";
import type { ProgressType } from "@/lib/types";

export function GraphTypePicker() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const isEnabled = settings.progressType !== "none";

  const handleToggle = (enabled: boolean) => {
    updateSettings({ progressType: enabled ? "circular" : "none" });
  };

  const setType = (type: ProgressType) => {
    updateSettings({ progressType: type });
  };

  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "16px 20px",
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: isEnabled ? 12 : 0 }}>
        <Body1Strong>Graph</Body1Strong>
        <Switch checked={isEnabled} onChange={handleToggle} />
      </div>
      {isEnabled && (
        <div className="flex gap-3">
          <StyleCard
            selected={settings.progressType === "circular"}
            onClick={() => setType("circular")}
            label="Ring"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={tokens.colorNeutralStroke2} strokeWidth="3" />
              <circle cx="12" cy="12" r="10" stroke={tokens.colorBrandBackground} strokeWidth="3" strokeDasharray="47 63" strokeLinecap="round" transform="rotate(-90 12 12)" opacity="0.7" />
            </svg>
          </StyleCard>
          <StyleCard
            selected={settings.progressType === "bar"}
            onClick={() => setType("bar")}
            label="Bar"
          >
            <div className="flex flex-col gap-0.5">
              {Array.from({ length: 10 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 24,
                    height: 3,
                    borderRadius: 1,
                    backgroundColor: i < 7 ? tokens.colorBrandBackground : tokens.colorNeutralStroke2,
                    opacity: i < 7 ? 0.7 : 1,
                  }}
                />
              )).reverse()}
            </div>
          </StyleCard>
        </div>
      )}
    </div>
  );
}

import { tokens, Caption1, Body1Strong } from "@fluentui/react-components";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { StyleCard } from "@/components/ui/StyleCard";
import { Select } from "@/components/ui/Select";
import { useSettingsStore } from "@/stores/settings-store";
import { POLLING_RATES } from "@/lib/types";
import { Footer } from "./Footer";
import { launchHardwareMonitor, setAutoStart, getAutoStart } from "@/lib/tauri";
import { useEffect, useState } from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "16px 20px",
      }}
    >
      <Body1Strong style={{ display: "block", marginBottom: 12 }}>{title}</Body1Strong>
      {children}
    </div>
  );
}

export function AppSettingsTab() {
  const settings = useSettingsStore((s) => s.settings);
  const preferences = useSettingsStore((s) => s.preferences);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);
  const clearSettings = useSettingsStore((s) => s.clearSettings);
  const [autoStart, setAutoStartState] = useState(false);

  useEffect(() => {
    getAutoStart().then((v) => { if (v !== undefined) setAutoStartState(v); }).catch(() => {});
  }, []);

  const handleAutoStart = (enabled: boolean) => {
    setAutoStartState(enabled);
    setAutoStart(enabled).catch(() => setAutoStartState(!enabled));
  };

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ padding: 16, gap: 16 }}>
      <Section title="General">
        <div className="flex flex-col gap-0.5">
          <Checkbox
            label="Start with Windows"
            checked={autoStart}
            onChange={handleAutoStart}
          />
          <Checkbox
            label="Start Minimized"
            checked={preferences.startMinimized}
            onChange={(v) => updatePreferences({ startMinimized: v })}
          />
          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <Button
              variant="filled"
              size="sm"
              onClick={() => launchHardwareMonitor().catch(() => {})}
            >
              Start Hardware Monitor
            </Button>
            <Button variant="outlined" size="sm" onClick={clearSettings}>
              Clear preferences
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-3">
          <StyleCard
            selected={!settings.isDarkTheme}
            onClick={() => updateSettings({ isDarkTheme: false })}
            label="Light"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="4" stroke={tokens.colorBrandForeground1} strokeWidth="1.5" />
              <path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.9 4.9L6.3 6.3M13.7 13.7L15.1 15.1M15.1 4.9L13.7 6.3M6.3 13.7L4.9 15.1" stroke={tokens.colorBrandForeground1} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </StyleCard>
          <StyleCard
            selected={settings.isDarkTheme}
            onClick={() => updateSettings({ isDarkTheme: true })}
            label="Dark"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M17 11.5C16.2 14.6 13.4 17 10 17C6 17 3 14 3 10C3 6.6 5.4 3.8 8.5 3C7.6 4.3 7 5.9 7 7.5C7 11.1 9.9 14 13.5 14C14.1 14 14.7 13.9 15.2 13.8C15.9 13.1 16.5 12.3 17 11.5Z" stroke={tokens.colorBrandForeground1} strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </StyleCard>
        </div>
        <div style={{ marginTop: 12 }}>
          <Checkbox
            label="Light meter"
            checked={settings.isMeterLight}
            onChange={(v) => updateSettings({ isMeterLight: v })}
          />
          <Caption1 style={{ color: tokens.colorNeutralForeground4, display: "block", marginTop: 4 }}>
            Use a light-colored overlay meter, independent of the app theme.
          </Caption1>
        </div>
      </Section>

      <Section title="Recording">
        <Select
          label="Polling Rate"
          value={String(settings.pollingRate)}
          options={POLLING_RATES.map((rate) => ({
            value: String(rate),
            label: `${rate}ms`,
          }))}
          onChange={(v) => updateSettings({ pollingRate: parseInt(v) })}
          disclaimer="How often the app polls hardware data. Lower = more updates, higher CPU impact."
        />
      </Section>

      <Footer />
    </div>
  );
}

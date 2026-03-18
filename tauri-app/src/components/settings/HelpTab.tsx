import {
  Body1,
  Body1Strong,
  Caption1,
  tokens,
} from "@fluentui/react-components";
import { Collapsible } from "@/components/ui/Collapsible";
import { Switch } from "@/components/ui/Switch";
import { useSettingsStore } from "@/stores/settings-store";

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        padding: "12px 20px",
      }}
    >
      {children}
    </div>
  );
}

export function HelpTab() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <div className="flex flex-col overflow-y-auto h-full" style={{ padding: 16, gap: 16 }}>
      <Section>
        <Collapsible title="How to Setup" defaultOpen={false}>
          <ol className="flex flex-col gap-2 list-decimal pl-5">
            <Body1 as="li">Launch CleanMeter — it will ask for administrator access on first run</Body1>
            <Body1 as="li">Configure which sensors to display in the Stats tab</Body1>
            <Body1 as="li">Customize the overlay appearance in the Style tab</Body1>
          </ol>
        </Collapsible>
      </Section>

      <Section>
        <Collapsible title="Current Limitations" defaultOpen={false}>
          <ul className="flex flex-col gap-2 list-disc pl-5">
            <Body1 as="li">Does not work with exclusive fullscreen — use borderless windowed instead</Body1>
            <Body1 as="li">Requires .NET 8.0 runtime</Body1>
            <Body1 as="li">Windows only (for now)</Body1>
          </ul>
        </Collapsible>
      </Section>

      <Section>
        <Collapsible title="FAQ" defaultOpen={false}>
          <div className="flex flex-col gap-4">
            <FaqItem q="The overlay doesn't show up" a="Make sure you're running the game in borderless windowed mode, not exclusive fullscreen." />
            <FaqItem q="FPS counter shows 0" a="Select the correct application from the PresentMon dropdown in Stats > FPS." />
            <FaqItem q="Sensors show wrong values" a="Try selecting a different sensor from the dropdown. Some systems have multiple sensors." />
          </div>
        </Collapsible>
      </Section>

      <Section>
        <Collapsible title="Hotkeys" defaultOpen={false}>
          <div className="flex flex-col gap-3">
            <HotkeyRow label="Toggle overlay" keys={["Ctrl", "F10"]} />
            <HotkeyRow label="Toggle data recording" keys={["Alt", "F11"]} />
          </div>
        </Collapsible>
      </Section>

      <Section>
        <div className="flex items-center justify-between" style={{ padding: "4px 0" }}>
          <Body1Strong>Application Logs</Body1Strong>
          <Switch
            checked={settings.isLoggingEnabled}
            onChange={(v) => updateSettings({ isLoggingEnabled: v })}
          />
        </div>
        {settings.isLoggingEnabled && (
          <div
            style={{
              height: 128,
              overflow: "auto",
              borderRadius: 6,
              padding: 10,
              marginTop: 8,
              fontFamily: "'Cascadia Code', 'Consolas', monospace",
              fontSize: 11,
              background: tokens.colorNeutralBackground3,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              color: tokens.colorNeutralForeground3,
            }}
          >
            <span style={{ color: tokens.colorNeutralForeground4 }}>No logs yet...</span>
          </div>
        )}
      </Section>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <Body1Strong>{q}</Body1Strong>
      <Body1 style={{ color: tokens.colorNeutralForeground3, marginTop: 2 }}>{a}</Body1>
    </div>
  );
}

function HotkeyRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="flex items-center justify-between">
      <Body1>{label}</Body1>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>+</Caption1>}
            <kbd
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                padding: "0 8px",
                borderRadius: 4,
                background: tokens.colorNeutralBackground3,
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                color: tokens.colorNeutralForeground1,
              }}
            >
              {key}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}

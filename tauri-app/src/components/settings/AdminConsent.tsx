import {
  Button,
  Title2,
  Body1,
  tokens,
} from "@fluentui/react-components";
import { ShieldCheckmark24Regular } from "@fluentui/react-icons";
import { grantAdminConsent, launchHardwareMonitor, isBrowser } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";

export function AdminConsent() {
  const updatePreferences = useSettingsStore((s) => s.updatePreferences);

  const handleAllow = async () => {
    await grantAdminConsent();
    updatePreferences({ adminConsent: true });
    launchHardwareMonitor().catch(() => {});
  };

  const handleClose = async () => {
    if (isBrowser) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().close();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-full max-w-[400px] flex flex-col items-center text-center gap-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: tokens.colorNeutralBackground1,
            border: `1px solid ${tokens.colorNeutralStroke1}`,
          }}
        >
          <ShieldCheckmark24Regular
            style={{
              fontSize: 40,
              color: tokens.colorBrandForeground1,
            }}
          />
        </div>

        <div>
          <Title2 as="h1" style={{ marginBottom: 12, display: "block" }}>
            Administrator Access
          </Title2>
          <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
            CleanMeter needs administrator access to read hardware sensors from
            your system. This is required for monitoring CPU, GPU, RAM, and
            network statistics.
          </Body1>
        </div>

        <div className="flex gap-3 w-full">
          <Button
            appearance="outline"
            onClick={handleClose}
            style={{ flex: 1 }}
          >
            Close app
          </Button>
          <Button
            appearance="primary"
            onClick={handleAllow}
            style={{ flex: 1 }}
          >
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { tokens } from "@fluentui/react-components";
import { TopBar } from "@/components/settings/TopBar";
import { TabNav, type SettingsTab } from "@/components/settings/TabNav";
import { AdminConsent } from "@/components/settings/AdminConsent";
import { StatsTab } from "@/components/settings/stats/StatsTab";
import { StyleTab } from "@/components/settings/style/StyleTab";
import { AppSettingsTab } from "@/components/settings/AppSettingsTab";
import { HelpTab } from "@/components/settings/HelpTab";
import { useSensorData } from "@/hooks/useSensorData";
import { useHotkey } from "@/hooks/useHotkey";
import { useSettingsStore } from "@/stores/settings-store";
import { isBrowser } from "@/lib/tauri";

export default function App() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("stats");
  const settings = useSettingsStore((s) => s.settings);
  const preferences = useSettingsStore((s) => s.preferences);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadPreferences = useSettingsStore((s) => s.loadPreferences);
  const loadAppVersion = useSettingsStore((s) => s.loadAppVersion);

  useSensorData();
  useHotkey();

  useEffect(() => {
    loadSettings();
    loadPreferences();
    loadAppVersion();
  }, [loadSettings, loadPreferences, loadAppVersion]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      settings.isDarkTheme ? "dark" : "light"
    );
  }, [settings.isDarkTheme]);

  if (!isBrowser && !preferences.adminConsent) {
    return (
      <div
        style={{ background: tokens.colorNeutralBackground3 }}
        className="h-screen w-screen"
        data-theme={settings.isDarkTheme ? "dark" : "light"}
      >
        <AdminConsent />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen w-screen"
      style={{ background: tokens.colorNeutralBackground3 }}
    >
      <TopBar />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 min-h-0">
        {activeTab === "stats" && <StatsTab />}
        {activeTab === "style" && <StyleTab />}
        {activeTab === "settings" && <AppSettingsTab />}
        {activeTab === "help" && <HelpTab />}
      </div>
    </div>
  );
}

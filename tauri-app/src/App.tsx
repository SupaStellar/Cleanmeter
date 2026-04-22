import { useEffect, useState } from "react";
import { TopBar } from "@/components/settings/TopBar";
import { TabNav, type SettingsTab } from "@/components/settings/TabNav";
import { StatsTab } from "@/components/settings/stats/StatsTab";
import { StyleTab } from "@/components/settings/style/StyleTab";
import { AppSettingsTab } from "@/components/settings/AppSettingsTab";
import { AboutTab } from "@/components/settings/AboutTab";
import { useSensorData } from "@/hooks/useSensorData";
import { useHotkey } from "@/hooks/useHotkey";
import { useSettingsStore } from "@/stores/settings-store";
import { checkDotnetRuntime } from "@/lib/tauri";

function MonitoringBanner() {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const pipeStatus = useSettingsStore((s) => s.pipeStatus);
  const [showBanner, setShowBanner] = useState(false);
  const [dotnetMissing, setDotnetMissing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!useSettingsStore.getState().sensorData) {
        setShowBanner(true);
        checkDotnetRuntime().then((ok) => {
          if (!ok) setDotnetMissing(true);
        }).catch(() => {});
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (sensorData) setShowBanner(false);
  }, [sensorData]);

  if (!showBanner) return null;

  return (
    <div className="border-b border-yellow-400 bg-yellow-50 px-4 py-2.5 text-[13px] leading-snug text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
      <strong>Monitoring not connected.</strong>
      {dotnetMissing ? (
        <span>
          {" "}.NET 8 Desktop Runtime is required but not installed.{" "}
          <a
            href="https://dotnet.microsoft.com/en-us/download/dotnet/8.0"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline dark:text-blue-400"
          >
            Download it here
          </a>
          , install it, then restart CleanMeter.
        </span>
      ) : (
        <span>
          {" "}HardwareMonitor is not responding. Try restarting the app.
          {!pipeStatus.connected && " (Pipe not connected)"}
        </span>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("stats");
  const settings = useSettingsStore((s) => s.settings);
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
      settings.isDarkTheme ? "dark" : "light",
    );
  }, [settings.isDarkTheme]);

  return (
    <div className="mx-auto flex h-screen w-full max-w-[651px] flex-col overflow-hidden rounded-[12px] border border-foreground/10 bg-background text-foreground shadow-sm">
      <TopBar />
      <MonitoringBanner />
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-6 pb-6 pt-6">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "stats" && <StatsTab />}
          {activeTab === "style" && <StyleTab />}
          {activeTab === "settings" && <AppSettingsTab />}
          {activeTab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

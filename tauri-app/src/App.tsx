import { useEffect, useState } from "react";
import { TopBar } from "@/components/settings/TopBar";
import { TabNav, type SettingsTab as TabKey } from "@/components/settings/TabNav";
import { StatsTab } from "@/components/settings/stats/StatsTab";
import { StyleTab } from "@/components/settings/style/StyleTab";
import { SettingsTab } from "@/components/settings/settings/SettingsTab";
import { HelpTab } from "@/components/settings/help/HelpTab";
import { useSensorData } from "@/hooks/useSensorData";
import { useHotkey } from "@/hooks/useHotkey";
import { useSettingsStore } from "@/stores/settings-store";
import { useUpdaterStore } from "@/stores/updater-store";
import { UpdateBanner } from "@/components/settings/UpdateBanner";
import { checkDotnetRuntime, onSettingsChanged } from "@/lib/tauri";

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

  // Hide the banner as soon as data arrives — derived from sensorData rather
  // than mirrored into state via an effect (which would cascade an extra
  // render). showBanner still gates the 8s "no data yet" delay above.
  if (!showBanner || sensorData) return null;

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
          , install it, then restart Cleanmeter.
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
  const [activeTab, setActiveTab] = useState<TabKey>("stats");
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadPreferences = useSettingsStore((s) => s.loadPreferences);
  const loadAppVersion = useSettingsStore((s) => s.loadAppVersion);
  const checkForUpdates = useUpdaterStore((s) => s.check);

  useSensorData();
  useHotkey();

  useEffect(() => {
    loadSettings();
    loadPreferences();
    loadAppVersion();
  }, [loadSettings, loadPreferences, loadAppVersion]);

  // Silent check on launch — surfaces the update badge only if a newer
  // release exists; stays quiet when up to date or offline.
  useEffect(() => {
    checkForUpdates({ silent: true });
  }, [checkForUpdates]);

  // Stay in sync with changes saved by the overlay window (e.g. a drag move).
  // Without this the settings store keeps a stale positionX/Y and re-saving any
  // unrelated setting would snap the dragged widget back. setState only — never
  // updateSettings — so the echo can't re-trigger a save loop.
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    onSettingsChanged((newSettings) => {
      useSettingsStore.setState({ settings: newSettings });
    })
      .then((u) => {
        if (active) unlisten = u;
        else u();
      })
      .catch((err) => {
        console.error("Failed to subscribe to settings changes:", err);
      });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

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
      <UpdateBanner />
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-6 pb-6 pt-6">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "stats" && <StatsTab />}
          {activeTab === "style" && <StyleTab />}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "help" && <HelpTab />}
        </div>
      </div>
    </div>
  );
}

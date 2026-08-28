import { useCallback, useEffect, useRef, useState } from "react";
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
import { checkDotnetRuntime, onSettingsChanged, onShortcutStatus } from "@/lib/tauri";
import { STARTUP_GRACE_MS, monitoringVerdict } from "@/lib/monitoring";
import { SplashScreen } from "@/components/SplashScreen";
import { Toast } from "@/components/ui/Toast";
import { useToastStore } from "@/stores/toast-store";
import { HOTKEY_IN_USE_MESSAGE } from "@/lib/shortcuts";

function MonitoringBanner() {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const pipeStatus = useSettingsStore((s) => s.pipeStatus);
  const sidecarStatus = useSettingsStore((s) => s.sidecarStatus);
  const [graceExpired, setGraceExpired] = useState(false);
  const [dotnetMissing, setDotnetMissing] = useState(false);

  // The banner used to be a plain 8s timer, which is not evidence of a failure:
  // a reading cannot exist before the sidecar has enumerated hardware, and that
  // alone measured up to 13.7s across 114 launches, so a third of them were
  // called broken while starting normally. At logon it happened nearly every
  // time. The verdict now comes from what the supervisor actually saw (see
  // monitoringVerdict), and this timer is only the backstop for a sidecar that
  // runs but never reports.
  useEffect(() => {
    const timer = setTimeout(() => setGraceExpired(true), STARTUP_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  const verdict = monitoringVerdict({
    hasSensorData: !!sensorData,
    sidecar: sidecarStatus,
    graceExpired,
  });

  // Only a failing verdict is worth telling the user about, and only then is it
  // worth paying for the .NET probe.
  useEffect(() => {
    if (verdict !== "failed") return;
    checkDotnetRuntime()
      .then((ok) => {
        if (!ok) setDotnetMissing(true);
      })
      .catch(() => {});
  }, [verdict]);

  if (verdict !== "failed") return null;

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
  // Startup splash: shown on every launch from first paint, covering the UI
  // (and the light→dark theme flash while saved settings load) until the
  // logo's ring sweep completes, then fades out and unmounts. Stable callback
  // so App re-renders (settings load ~200ms in) don't re-run the splash's
  // timer effect and stretch the hold.
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashDone = useCallback(() => setShowSplash(false), []);
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

  // Which global shortcuts the OS refused, which exists for exactly one
  // purpose: raising the refusal toast, the same message an in-app clash
  // raises from ShortcutField. From the user's side "the other row has it"
  // and "another app has it" are one fact, so they get one message and the
  // field itself is left completely unmarked (Saad, 2026-08-28).
  //
  // Raised here rather than in the field because this is where the status
  // lands, and the failure is only known after the save round-trips through
  // Rust: the field has already committed and stopped listening by then.
  //
  // Held in a ref rather than the store. Nothing renders it now, and a store
  // field no component reads is state that looks live and is not.
  const previousRefusals = useRef<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    // The first pass is startup's, and it reports what could not be bound from
    // stored settings. Toasting there would fire on every launch for a combo
    // some other application permanently owns, which is not news — the field's
    // stroke already says it. Only a change from this point on is an event.
    let seenFirstStatus = false;
    onShortcutStatus((unavailable) => {
      const newlyRefused = Object.keys(unavailable).some(
        (k) => previousRefusals.current[k] === undefined,
      );
      previousRefusals.current = unavailable;
      if (seenFirstStatus && newlyRefused) {
        useToastStore.getState().showToast(HOTKEY_IN_USE_MESSAGE);
      }
      seenFirstStatus = true;
    })
      .then((u) => {
        if (active) unlisten = u;
        else u();
      })
      .catch((err) => {
        console.error("Failed to subscribe to shortcut status:", err);
      });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  // Keep <html data-theme> in sync and mirror the resolved theme into
  // localStorage so the pre-hydration script in index.html can paint the
  // correct theme on the next launch before settings load — no startup flash.
  useEffect(() => {
    const theme = settings.isDarkTheme ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("cm-theme", theme);
    } catch {
      /* localStorage unavailable — theme still applies for this session */
    }
  }, [settings.isDarkTheme]);

  // The window edge is an outline rather than a border: Figma strokes this
  // frame OUTSIDE, so its stroke costs no layout and 651 is the content box.
  // A 1px border ate 2 of that and left every card 601 instead of 603.
  return (
    <div className="relative mx-auto flex h-screen w-full max-w-[651px] flex-col overflow-hidden rounded-[12px] outline outline-1 -outline-offset-1 outline-foreground/10 bg-background text-foreground shadow-sm">
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {/* Against the window frame, not inside a tab: Figma 2819:9753 centres
          it over the whole window at y 76, which puts it across the TopBar
          and the tab strip. It also has to outlive a tab switch, and the tabs
          unmount nothing but they do scroll. */}
      <Toast />
      <TopBar />
      <MonitoringBanner />
      <UpdateBanner />
      {/* Figma's window: 651 wide, 24 of padding around a 603 content column,
          20 between the tabs and the content. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacingL)] p-[var(--spacingXl)]">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Tabs stay mounted and hide via CSS so local UI state (expanded
              collapsibles, dropdowns, scroll targets) survives tab switches —
              conditional rendering reset it all on every switch. */}
          <div className={activeTab === "stats" ? "h-full" : "hidden"}>
            <StatsTab />
          </div>
          <div className={activeTab === "style" ? "h-full" : "hidden"}>
            <StyleTab />
          </div>
          <div className={activeTab === "settings" ? "h-full" : "hidden"}>
            <SettingsTab />
          </div>
          <div className={activeTab === "help" ? "h-full" : "hidden"}>
            <HelpTab />
          </div>
        </div>
      </div>
    </div>
  );
}

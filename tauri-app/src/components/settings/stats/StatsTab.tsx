import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { HotkeyBar } from "./HotkeyBar";
import { FpsSection } from "./FpsSection";
import { GpuSection } from "./GpuSection";
import { CpuSection } from "./CpuSection";
import { RamSection } from "./RamSection";
import { NetworkSection } from "./NetworkSection";
import { MonitorSection } from "./MonitorSection";
import { UpdateBanner, type UpdateStatus } from "./UpdateBanner";

export function StatsTab() {
  const sensorData = useSettingsStore((s) => s.sensorData);
  const sensors = sensorData?.sensors ?? [];
  const hardwares = sensorData?.hardwares ?? [];

  // TODO: replace with updater API. Mocked locally so the banner UI can be
  // exercised end-to-end (idle → downloading → complete).
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>("idle");
  // Until the updater API is wired, surface the actual running version rather
  // than a stale literal. TODO: once the updater lands, show the *available*
  // update version here, not the current one.
  const appVersion = useSettingsStore((s) => s.appVersion);

  useEffect(() => {
    if (updateStatus !== "downloading") return;
    const t = setTimeout(() => setUpdateStatus("complete"), 3000);
    return () => clearTimeout(t);
  }, [updateStatus]);

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <HotkeyBar />
      <FpsSection />
      <GpuSection sensors={sensors} hardwares={hardwares} />
      <CpuSection sensors={sensors} hardwares={hardwares} />
      <RamSection />
      <NetworkSection sensors={sensors} hardwares={hardwares} />
      <MonitorSection />
      <p className="text-label-sm-medium w-full text-right text-[var(--textDisabled)]">
        May your frames be high, and temps be low.
      </p>
      {updateStatus && (
        <UpdateBanner
          className="sticky bottom-4 z-10 mt-auto"
          status={updateStatus}
          version={appVersion}
          onLater={() => setUpdateStatus(null)}
          onUpdate={() => setUpdateStatus("downloading")}
          onCancel={() => setUpdateStatus("idle")}
          onInstall={() => {
            // TODO: replace with updater API — trigger Tauri updater install + relaunch.
            setUpdateStatus(null);
          }}
        />
      )}
    </div>
  );
}

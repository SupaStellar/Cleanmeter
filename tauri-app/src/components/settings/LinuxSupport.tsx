import { quitApp } from "@/lib/tauri";
import { usePlatformStore } from "@/stores/platform-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Switch } from "@/components/shadcn/switch";

export function LinuxSupport() {
  const { os, canPositionOverlay } = usePlatformStore((s) => s.platform);
  const visible = useSettingsStore((s) => s.overlayVisible);
  const setVisible = useSettingsStore((s) => s.setOverlayVisible);
  if (os !== "linux") return null;
  return (
    <>
      <label className="flex items-center justify-between text-[14px] font-medium">
        {canPositionOverlay ? "Show overlay" : "Show monitor window"}
        <Switch checked={visible} onCheckedChange={setVisible} aria-label={canPositionOverlay ? "Show overlay" : "Show monitor window"} />
      </label>
      <button type="button" onClick={() => void quitApp()} className="self-start rounded-[var(--cornerS)] text-[13px] underline focus-visible:shadow-focus-default">Quit Cleanmeter</button>
    </>
  );
}

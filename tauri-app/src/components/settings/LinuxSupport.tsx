import { usePlatformStore } from "@/stores/platform-store";
import { useSettingsStore } from "@/stores/settings-store";
import { Switch } from "@/components/shadcn/switch";

export function LinuxSupport() {
  const { os, canPositionOverlay } = usePlatformStore((s) => s.platform);
  const visible = useSettingsStore((s) => s.overlayVisible);
  const setVisible = useSettingsStore((s) => s.setOverlayVisible);
  if (os !== "linux") return null;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--cornerXl)] bg-[var(--bgSurfaceRaised)] p-[var(--spacingL)] text-[var(--textHeading)]">
      <label className="flex items-center justify-between text-[14px] font-medium">
        {canPositionOverlay ? "Show overlay" : "Show monitor window"}
        <Switch checked={visible} onCheckedChange={setVisible} aria-label="Show monitor" />
      </label>
      <p className="text-[13px] text-muted-foreground">
        {canPositionOverlay
          ? "Linux preview · X11/XWayland. Overlay visibility in fullscreen games depends on your desktop."
          : "Wayland controls window placement. Use the monitor as a separate window, or sign in with an X11 session for overlay positioning and global shortcuts."}
      </p>
      <p className="text-[13px] text-muted-foreground">Temperature, power, and GPU readings depend on your hardware driver. Unavailable sensors are not collected.</p>
    </section>
  );
}

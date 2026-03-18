import { useEffect } from "react";
import { OverlayHud } from "@/components/overlay/OverlayHud";
import { useSensorData } from "@/hooks/useSensorData";
import { useSettingsStore } from "@/stores/settings-store";
import { onSettingsChanged, onHotkey, onSetOpacity } from "@/lib/tauri";

export default function OverlayApp() {
  const overlayVisible = useSettingsStore((s) => s.overlayVisible);
  const toggleOverlay = useSettingsStore((s) => s.toggleOverlay);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useSensorData();

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      const u1 = await onSettingsChanged((newSettings) => {
        useSettingsStore.setState({ settings: newSettings });
      });
      if (mounted) unlisteners.push(u1); else u1();

      const u2 = await onHotkey((action) => {
        if (action === "toggle-overlay") {
          toggleOverlay();
        }
      });
      if (mounted) unlisteners.push(u2); else u2();

      const u3 = await onSetOpacity((opacity) => {
        document.documentElement.style.opacity = String(opacity);
      });
      if (mounted) unlisteners.push(u3); else u3();
    };
    setup();

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, [toggleOverlay]);

  const settings = useSettingsStore((s) => s.settings);
  const idx = settings.positionIndex;

  // CSS-based positioning: 0=TL, 1=TC, 2=TR, 3=BL, 4=BC, 5=BR, 6=custom
  const isCustom = idx === 6;
  const alignMap: Record<number, React.CSSProperties> = {
    0: { alignItems: "flex-start", justifyContent: "flex-start" },
    1: { alignItems: "flex-start", justifyContent: "center" },
    2: { alignItems: "flex-start", justifyContent: "flex-end" },
    3: { alignItems: "flex-end", justifyContent: "flex-start" },
    4: { alignItems: "flex-end", justifyContent: "center" },
    5: { alignItems: "flex-end", justifyContent: "flex-end" },
  };

  const offsetX = settings.positionX || 0;
  const offsetY = settings.positionY || 0;

  const containerStyle: React.CSSProperties = {
    width: "100vw",
    height: "100vh",
    background: "transparent",
    padding: 8,
    boxSizing: "border-box",
    display: "flex",
    ...alignMap[idx],
  };

  const hudStyle: React.CSSProperties = {
    transform: `translate(${offsetX}px, ${offsetY}px)`,
  };

  return (
    <div style={containerStyle}>
      <div style={hudStyle}>
        <OverlayHud />
      </div>
    </div>
  );
}

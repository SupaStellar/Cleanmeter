import { useEffect, useRef } from "react";
import { OverlayHud } from "@/components/overlay/OverlayHud";
import { useSensorData } from "@/hooks/useSensorData";
import { useSettingsStore } from "@/stores/settings-store";
import { onSettingsChanged, onHotkey, onSetOpacity } from "@/lib/tauri";

export default function OverlayApp() {
  const toggleOverlay = useSettingsStore((s) => s.toggleOverlay);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

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
        if (action === "toggle-overlay") toggleOverlay();
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
  const useCustom = settings.useCustomPosition;
  const locked = settings.isPositionLocked;

  // Preset flex alignment: 0=TL, 1=TC, 2=TR, 3=BL, 4=BC, 5=BR
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

  // ── Manual drag (custom-position mode) ──
  // The overlay window covers the whole monitor, so Tauri's native window drag
  // is a no-op. Instead we track mouse on the HUD and persist its top-left as
  // (positionX, positionY) in settings.
  const hudRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!useCustom || locked) return;
    if (e.button !== 0) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: offsetX,
      originY: offsetY,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!useCustom || locked) return;
    const onMouseMove = (e: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      const hud = hudRef.current;
      if (hud) {
        hud.style.left = `${st.originX + dx}px`;
        hud.style.top = `${st.originY + dy}px`;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      const st = dragState.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      dragState.current = null;
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        updateSettings({ positionX: st.originX + dx, positionY: st.originY + dy });
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [useCustom, locked, updateSettings]);

  const containerStyle: React.CSSProperties = useCustom
    ? {
        width: "100vw",
        height: "100vh",
        background: "transparent",
        position: "relative",
      }
    : {
        width: "100vw",
        height: "100vh",
        background: "transparent",
        padding: 8,
        boxSizing: "border-box",
        display: "flex",
        ...alignMap[idx],
      };

  const hudStyle: React.CSSProperties = useCustom
    ? {
        position: "absolute",
        left: offsetX,
        top: offsetY,
        cursor: locked ? "default" : "grab",
        userSelect: "none",
      }
    : {};

  return (
    <div style={containerStyle}>
      <div ref={hudRef} style={hudStyle} onMouseDown={onMouseDown}>
        <OverlayHud />
      </div>
    </div>
  );
}

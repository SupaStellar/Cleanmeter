import { useEffect, useRef, useState } from "react";
import { OverlayHud } from "@/components/overlay/OverlayHud";
import { useSensorData } from "@/hooks/useSensorData";
import { useSettingsStore } from "@/stores/settings-store";
import {
  onSettingsChanged,
  onSetOpacity,
  getMonitors,
  setOverlayPosition,
  setOverlaySize,
} from "@/lib/tauri";
import type { MonitorInfo } from "@/lib/types";

const EDGE_PADDING = 8;

// 0=TL, 1=TC, 2=TR, 3=BL, 4=BC, 5=BR — in physical pixels.
function computePresetPosition(
  idx: number,
  monitor: MonitorInfo,
  hudW: number,
  hudH: number,
): { x: number; y: number } {
  const pad = EDGE_PADDING;
  const isBottom = idx >= 3;
  const col = idx % 3;
  const y = isBottom
    ? monitor.y + monitor.height - hudH - pad
    : monitor.y + pad;
  let x: number;
  if (col === 0) x = monitor.x + pad;
  else if (col === 1) x = monitor.x + Math.floor((monitor.width - hudW) / 2);
  else x = monitor.x + monitor.width - hudW - pad;
  return { x, y };
}

export default function OverlayApp() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const settings = useSettingsStore((s) => s.settings);

  useSensorData();

  const hudRef = useRef<HTMLDivElement>(null);
  const hudSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dragStart = useRef<
    {
      mouseX: number;
      mouseY: number;
      winX: number;
      winY: number;
      lastWinX: number;
      lastWinY: number;
    } | null
  >(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    loadSettings();
    getMonitors().then((m) => m && setMonitors(m));
  }, [loadSettings]);

  useEffect(() => {
    let mounted = true;
    const unlisteners: Array<() => void> = [];
    const setup = async () => {
      // The settings window owns the hotkey handler (useHotkey in App.tsx). If
      // the overlay window also toggled visibility, the two independent Zustand
      // stores could get out of sync and fight each other (see fix below).
      const u1 = await onSettingsChanged((newSettings) => {
        useSettingsStore.setState({ settings: newSettings });
      });
      if (mounted) unlisteners.push(u1); else u1();
      const u2 = await onSetOpacity((opacity) => {
        document.documentElement.style.opacity = String(opacity);
      });
      if (mounted) unlisteners.push(u2); else u2();
    };
    setup();
    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  // Keep the OS window sized to the HUD and positioned per settings. The window
  // stays as small as the HUD, so `set_ignore_cursor_events(false)` only affects
  // HUD pixels — never freezes the rest of the desktop.
  useEffect(() => {
    const el = hudRef.current;
    if (!el || monitors.length === 0) return;
    const monitor = monitors[settings.selectedDisplayIndex] ?? monitors[0];

    const apply = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = window.devicePixelRatio || 1;
      const hudW = Math.max(1, Math.ceil(rect.width * scale));
      const hudH = Math.max(1, Math.ceil(rect.height * scale));
      hudSizeRef.current = { w: hudW, h: hudH };
      setOverlaySize(hudW, hudH);

      // Skip position updates while the user is actively dragging.
      if (dragStart.current) return;

      let x: number;
      let y: number;
      if (settings.useCustomPosition) {
        x = monitor.x + Math.round(settings.positionX);
        y = monitor.y + Math.round(settings.positionY);
      } else {
        const p = computePresetPosition(settings.positionIndex, monitor, hudW, hudH);
        x = p.x;
        y = p.y;
      }
      setOverlayPosition(x, y);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
    // Only re-fire the IPC moves/sizes when a position-relevant field
    // changes — not on every settings update (font sizes, sensor toggles,
    // etc. would otherwise round-trip a no-op setOverlayPosition).
  }, [
    settings.selectedDisplayIndex,
    settings.useCustomPosition,
    settings.positionX,
    settings.positionY,
    settings.positionIndex,
    monitors,
  ]);

  // Manual drag. startDragging() needed an async dynamic import that lost the
  // button-down window on Windows before WM_NCLBUTTONDOWN could post, so drag
  // never started. The window position is derived synchronously from
  // monitors + settings (instead of an async Tauri round-trip) so mousemove
  // events that fire on the same tick as mousedown aren't dropped.
  const onMouseDown = (e: React.MouseEvent) => {
    if (!settings.useCustomPosition || settings.isPositionLocked) return;
    if (e.button !== 0) return;
    if (monitors.length === 0) return;
    e.preventDefault();
    const monitor = monitors[settings.selectedDisplayIndex] ?? monitors[0];
    const winX = monitor.x + Math.round(settings.positionX);
    const winY = monitor.y + Math.round(settings.positionY);
    dragStart.current = {
      mouseX: e.screenX,
      mouseY: e.screenY,
      winX,
      winY,
      lastWinX: winX,
      lastWinY: winY,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = dragStart.current;
      if (!s) return;
      // Read DPR per-move so dragging across monitors with different scale
      // factors picks up the new value as Windows fires WM_DPICHANGED.
      const dpr = window.devicePixelRatio || 1;
      const dx = (e.screenX - s.mouseX) * dpr;
      const dy = (e.screenY - s.mouseY) * dpr;
      const newX = Math.round(s.winX + dx);
      const newY = Math.round(s.winY + dy);
      s.lastWinX = newX;
      s.lastWinY = newY;
      setOverlayPosition(newX, newY);
    };
    const onUp = () => {
      const s = dragStart.current;
      if (!s) return;
      dragStart.current = null;
      setIsDragging(false);
      if (monitors.length === 0) return;
      const { w: hudW, h: hudH } = hudSizeRef.current;
      const cx = s.lastWinX + hudW / 2;
      const cy = s.lastWinY + hudH / 2;
      let idx = settings.selectedDisplayIndex;
      for (let i = 0; i < monitors.length; i++) {
        const m = monitors[i];
        if (cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height) {
          idx = i;
          break;
        }
      }
      const m = monitors[idx] ?? monitors[0];
      updateSettings({
        selectedDisplayIndex: idx,
        positionX: Math.round(s.lastWinX - m.x),
        positionY: Math.round(s.lastWinY - m.y),
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [monitors, updateSettings, settings.selectedDisplayIndex]);

  const draggable = settings.useCustomPosition && !settings.isPositionLocked;
  const rootStyle: React.CSSProperties = {
    cursor: draggable ? (isDragging ? "grabbing" : "grab") : "default",
    userSelect: "none",
    background: "transparent",
    display: "inline-block",
  };

  return (
    <div ref={hudRef} style={rootStyle} onMouseDown={onMouseDown}>
      <OverlayHud />
    </div>
  );
}

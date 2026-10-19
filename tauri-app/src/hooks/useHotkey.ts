import { useEffect, useState } from "react";
import { onHotkey, takePendingOverlayLaunch } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";

export function useHotkey() {
  const toggleOverlay = useSettingsStore((s) => s.toggleOverlay);
  const sensorReady = useSettingsStore((s) => s.sensorData !== null);
  const [listenerReady, setListenerReady] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    onHotkey((action) => {
      if (action === "toggle-overlay") {
        toggleOverlay();
      }
      // The recording keys never come through here: shortcuts.rs handles
      // them itself, because they have to work with every window closed.
    }).then((u) => {
      if (!mounted) { u(); return; }
      unlisten = u;
      setListenerReady(true);
    });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [toggleOverlay]);

  useEffect(() => {
    // Initial sensor arrival auto-shows the overlay. Drain launch requests
    // afterwards so a second press during boot hides it rather than having
    // its intent overwritten by that initial auto-show.
    if (!listenerReady || !sensorReady) return;
    void takePendingOverlayLaunch().then((pending) => {
      if (pending) toggleOverlay();
    });
  }, [listenerReady, sensorReady, toggleOverlay]);
}

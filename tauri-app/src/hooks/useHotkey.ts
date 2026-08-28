import { useEffect } from "react";
import { onHotkey } from "@/lib/tauri";
import { useSettingsStore } from "@/stores/settings-store";

export function useHotkey() {
  const toggleOverlay = useSettingsStore((s) => s.toggleOverlay);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onHotkey((action) => {
      if (action === "toggle-overlay") {
        toggleOverlay();
      }
      // The recording keys never come through here: shortcuts.rs handles
      // them itself, because they have to work with every window closed.
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      unlisten?.();
    };
  }, [toggleOverlay]);
}

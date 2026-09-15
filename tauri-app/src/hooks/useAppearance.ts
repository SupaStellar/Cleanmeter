import { useMemo } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { normalizeAppearance } from "@/lib/customization/schema";

export function useAppearance() {
  const raw = useSettingsStore(s => s.settings.appearance);
  return useMemo(() => normalizeAppearance(raw), [raw]);
}

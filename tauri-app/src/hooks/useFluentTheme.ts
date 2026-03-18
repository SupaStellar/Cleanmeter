import {
  webLightTheme,
  webDarkTheme,
  type Theme,
} from "@fluentui/react-components";
import { useSettingsStore } from "@/stores/settings-store";

const fontOverrides = {
  fontFamilyBase: "'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
};

const lightTheme: Theme = {
  ...webLightTheme,
  ...fontOverrides,
};

const softDarkTheme: Theme = {
  ...webDarkTheme,
  ...fontOverrides,
  colorNeutralStroke1: "rgba(255, 255, 255, 0.07)",
  colorNeutralStroke2: "rgba(255, 255, 255, 0.05)",
  colorNeutralStroke3: "rgba(255, 255, 255, 0.03)",
};

export function useFluentTheme(): Theme {
  const isDark = useSettingsStore((s) => s.settings.isDarkTheme);
  return isDark ? softDarkTheme : lightTheme;
}

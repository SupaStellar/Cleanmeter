import { DEFAULT_APPEARANCE, parsePreset, type AppearancePreset } from "./schema";
import type { OverlaySettings } from "../types";

export function capturePreset(name: string, settings: OverlaySettings): AppearancePreset {
  return parsePreset({ version: 1, name, appearance: settings.appearance,
    typography: { valueSize: settings.fontSizeValue, labelSize: settings.fontSizeLabel, valueWeight: settings.fontWeight, labelWeight: settings.labelFontWeight } });
}
export function presetPatch(preset: AppearancePreset): Partial<OverlaySettings> {
  const p = parsePreset(preset);
  return { appearance: p.appearance, fontSizeValue: p.typography.valueSize, fontSizeLabel: p.typography.labelSize,
    fontWeight: p.typography.valueWeight, labelFontWeight: p.typography.labelWeight };
}
const STORAGE_KEY = "cleanmeter.appearance-presets.v1";
export function loadPresets(): AppearancePreset[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 20) throw new Error("Saved presets could not be read. Export working presets before clearing browser storage.");
  return parsed.map(parsePreset);
}
export function savePresets(presets: AppearancePreset[]) {
  if (presets.length > 20) throw new Error("You can save 20 presets. Export or remove one before adding another.");
  // Write first, then update UI: a quota error must never look like a successful save.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.map(parsePreset)));
}
export const THEMES: AppearancePreset[] = [
  { name: "Midnight", value: "#f4f6ff", label: "#a9b4d4", inner: "#171e32", outer: "#080c18", accent: "#8b9dff", radius: 12, gauge: "arc" },
  { name: "Terminal", value: "#b9ffbc", label: "#6fbc82", inner: "#092015", outer: "#04100a", accent: "#67ee89", radius: 2, gauge: "segments" },
  { name: "Paper", value: "#202633", label: "#536175", inner: "#ffffff", outer: "#dce4ef", accent: "#367bc9", radius: 8, gauge: "thin-ring" },
  { name: "Ember", value: "#fff4e8", label: "#efb88c", inner: "#351e18", outer: "#160f0d", accent: "#ff9858", radius: 20, gauge: "signal" },
  { name: "Violet", value: "#f7edff", label: "#cbb1e7", inner: "#29163e", outer: "#11091c", accent: "#d68bff", radius: 100, gauge: "orbit" },
  { name: "Ocean", value: "#e8fbff", label: "#8dc3d5", inner: "#0c293c", outer: "#061620", accent: "#52d4e8", radius: 6, gauge: "half-ring" },
].map(t => parsePreset({ version: 1, name: t.name, appearance: { ...DEFAULT_APPEARANCE, enabled: true,
  font: t.name === "Terminal" ? "Consolas" : "Inter", valueColor: t.value, labelColor: t.label, graphColor: t.accent,
  thresholdColors: false, gauge: t.gauge, inner: { ...DEFAULT_APPEARANCE.inner, color: t.inner, opacity: .85, radius: t.radius },
  outer: { ...DEFAULT_APPEARANCE.outer, color: t.outer, opacity: .9, radius: t.radius + 4 } } }));

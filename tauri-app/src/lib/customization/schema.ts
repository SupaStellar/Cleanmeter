// Portable, data-only appearance schema. Never include sensor IDs, shortcuts,
// executable paths or arbitrary CSS in a shared preset.
export const FONTS = ["Inter", "Arial", "Verdana", "Georgia", "Consolas", "Segoe UI", "Trebuchet MS", "Courier New"] as const;
export const SECTIONS = ["FPS", "CPU", "GPU", "RAM", "NET"] as const;
export type Section = typeof SECTIONS[number];
export const GAUGES = [
  "ring", "thin-ring", "double-ring", "dashed-ring", "dotted-ring", "radial-ticks",
  "arc", "half-ring", "needle", "compass", "pie", "donut",
  "bar", "vertical-bar", "stack", "segments", "ladder", "battery", "thermometer",
  "dots", "tiles", "diamonds", "honeycomb", "chevrons", "signal", "equalizer",
  "square", "diamond", "hexagon", "triangle", "orbit", "cross",
] as const;
export type GaugeStyle = typeof GAUGES[number];
export const TRACES = ["line", "area", "steps", "bars", "dots", "stems"] as const;
export const MAX_IMAGE_CHARS = 90_000;
export const MAX_PRESET_BYTES = 200_000;
export interface Surface {
  color: string; opacity: number; radius: number; paddingX: number; paddingY: number; image: string;
}
export interface Appearance {
  enabled: boolean;
  font: typeof FONTS[number];
  labelColor: string;
  valueColor: string;
  graphColor: string;
  thresholdColors: boolean;
  inner: Surface;
  outer: Surface;
  gap: number;
  gauge: GaugeStyle;
  trace: typeof TRACES[number];
  order: Section[];
}
export const DEFAULT_APPEARANCE: Appearance = {
  enabled: false, font: "Inter", labelColor: "#b8bdc8", valueColor: "#ffffff",
  graphColor: "#74dfa2", thresholdColors: true,
  inner: { color: "#000000", opacity: .3, radius: 100, paddingX: 12, paddingY: 4, image: "" },
  outer: { color: "#1e1e1e", opacity: .7, radius: 100, paddingX: 4, paddingY: 4, image: "" },
  gap: 4, gauge: "ring", trace: "line", order: [...SECTIONS],
};
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const color = (v: unknown, fallback: string) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
export function validImage(v: unknown): v is string {
  if (typeof v !== "string" || v.length > MAX_IMAGE_CHARS) return false;
  if (v === "") return true;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!match || match[2].length % 4 !== 0) return false;
  try {
    const header = atob(match[2].slice(0, 32));
    if (match[1] === "png") return header.startsWith("\x89PNG\r\n\x1a\n");
    if (match[1] === "jpeg") return header.startsWith("\xff\xd8\xff");
    return header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  } catch { return false; }
}
function surface(value: unknown, fallback: Surface): Surface {
  const v = record(value);
  return { color: color(v.color, fallback.color), opacity: number(v.opacity, fallback.opacity, 0, 1),
    radius: number(v.radius, fallback.radius, 0, 100), paddingX: number(v.paddingX, fallback.paddingX, 0, 32),
    paddingY: number(v.paddingY, fallback.paddingY, 0, 24), image: validImage(v.image) ? v.image : "" };
}
export function normalizeAppearance(value: unknown): Appearance {
  const v = record(value), d = DEFAULT_APPEARANCE;
  const order = Array.isArray(v.order) ? v.order.filter((s): s is Section => SECTIONS.includes(s as Section)) : [];
  return { enabled: v.enabled === true, font: FONTS.includes(v.font as Appearance["font"]) ? v.font as Appearance["font"] : d.font,
    labelColor: color(v.labelColor, d.labelColor), valueColor: color(v.valueColor, d.valueColor), graphColor: color(v.graphColor, d.graphColor),
    thresholdColors: typeof v.thresholdColors === "boolean" ? v.thresholdColors : d.thresholdColors,
    inner: surface(v.inner, d.inner), outer: surface(v.outer, d.outer), gap: number(v.gap, d.gap, 0, 24),
    gauge: GAUGES.includes(v.gauge as GaugeStyle) ? v.gauge as GaugeStyle : d.gauge,
    trace: TRACES.includes(v.trace as Appearance["trace"]) ? v.trace as Appearance["trace"] : d.trace,
    order: [...new Set([...order, ...SECTIONS])],
  };
}
export interface AppearancePreset {
  version: 1;
  name: string;
  appearance: Appearance;
  typography: { valueSize: number; labelSize: number; valueWeight: number; labelWeight: number };
}
export function parsePreset(input: unknown): AppearancePreset {
  const v = record(input);
  if (v.version !== 1) throw new Error("This preset version is not supported.");
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 60) throw new Error("Use a preset name between 1 and 60 characters.");
  if (!v.appearance || JSON.stringify(v).length > MAX_PRESET_BYTES) throw new Error("The preset is missing its appearance or is too large.");
  const a = record(v.appearance);
  for (const key of ["inner", "outer"]) {
    const image = record(a[key]).image;
    if (image !== undefined && !validImage(image)) throw new Error("Preset backgrounds must be small embedded PNG, JPEG or WebP images.");
  }
  const t = record(v.typography);
  return { version: 1, name: v.name.trim(), appearance: normalizeAppearance(v.appearance),
    typography: { valueSize: number(t.valueSize, 18, 8, 24), labelSize: number(t.labelSize, 12, 8, 18),
      valueWeight: Math.round(number(t.valueWeight, 500, 400, 700)), labelWeight: Math.round(number(t.labelWeight, 500, 400, 700)) } };
}
export function rgba(hex: string, alpha: number) {
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;
}

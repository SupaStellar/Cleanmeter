import { describe, expect, it, vi, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomGauge } from "@/components/overlay/CustomGauge";
import { gaugeFraction } from "./gauges";
import { DEFAULT_APPEARANCE, GAUGES, normalizeAppearance, parsePreset, SECTIONS } from "./schema";
import { capturePreset, loadPresets, presetPatch, savePresets, THEMES } from "./presets";
import { DEFAULT_SETTINGS } from "../types";

afterEach(() => vi.unstubAllGlobals());
describe("portable appearance", () => {
  it("preserves the original appearance for old and missing settings", () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance({}).enabled).toBe(false);
  });
  it("bounds dimensions and removes invalid colors, font CSS and duplicate sections", () => {
    const a = normalizeAppearance({ enabled: true, font: 'url(https://tracker)', valueColor: 'red; background:url(x)',
      gap: Infinity, order: ['GPU', 'GPU', '__proto__'], inner: { paddingX: -100, paddingY: 999, opacity: 20 } });
    expect(a.order).toEqual(['GPU', 'FPS', 'CPU', 'RAM', 'NET']);
    expect(a.font).toBe('Inter'); expect(a.valueColor).toBe('#ffffff'); expect(a.gap).toBe(4);
    expect(a.inner.paddingX).toBe(0); expect(a.inner.paddingY).toBe(24); expect(a.inner.opacity).toBe(1);
  });
  it.each(['https://tracker/image.png', 'file:///secret.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,QQ=='])('rejects unsafe shared background %s', image => {
    expect(() => parsePreset({ version: 1, name: 'x', appearance: { inner: { image } } })).toThrow(/background/);
  });
  it('rejects future formats and oversized payloads', () => {
    expect(() => parsePreset({ version: 2 })).toThrow(/version/);
    expect(() => parsePreset({ version: 1, name: 'x', appearance: {}, extra: 'x'.repeat(200001) })).toThrow(/large/);
  });
  it('round trips every built-in theme while excluding machine-specific settings', () => {
    for (const theme of THEMES) {
      const applied = { ...DEFAULT_SETTINGS, ...presetPatch(theme), selectedGpuId: '/gpu-secret', overlayShortcut: 'Alt+F7' };
      const exported = capturePreset(theme.name, applied);
      expect(parsePreset(JSON.parse(JSON.stringify(exported)))).toEqual(theme);
      expect(JSON.stringify(exported)).not.toContain('gpu-secret');
      expect(presetPatch(exported)).not.toHaveProperty('sensors');
      expect(presetPatch(exported)).not.toHaveProperty('overlayShortcut');
      expect(exported.appearance.order).toEqual(SECTIONS);
    }
  });
  it('persists local presets and surfaces quota failures', () => {
    const data = new Map<string,string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string,v: string) => data.set(k,v) });
    savePresets(THEMES); expect(loadPresets()).toEqual(THEMES);
    expect(() => savePresets(Array(21).fill(THEMES[0]))).toThrow(/20 presets/);
    vi.stubGlobal('localStorage', { setItem: () => { throw new Error('quota'); } });
    expect(() => savePresets(THEMES)).toThrow('quota');
  });
});
describe('gauge renderer', () => {
  it('bounds unknown, negative and excessive readings', () => {
    for (const [value,max,expected] of [[NaN,100,0],[Infinity,100,0],[-1,100,0],[50,0,0],[50,100,.5],[101,100,1]]) expect(gaugeFraction(value,max)).toBe(expected);
  });
  it('renders 32 different geometries without invalid coordinates at zero, partial and full values', () => {
    expect(GAUGES).toHaveLength(32);
    const geometry = new Set<string>();
    for (const style of GAUGES) {
      for (const value of [0,65,100,NaN]) {
        const svg = renderToStaticMarkup(createElement(CustomGauge, { style, value, color: '#74dfa2' }));
        expect(svg).not.toMatch(/NaN|Infinity/);
        if (value === 65) geometry.add(svg.replace(/data-gauge-style="[^"]*"/, ''));
      }
    }
    expect(geometry.size).toBe(32);
  });
});

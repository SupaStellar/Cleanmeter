import { useEffect, useRef, useState } from "react";
import { ColorControl, SelectControl, Slider, Toggle } from "dialkit";
import { useSettingsStore } from "@/stores/settings-store";
import { OverlayHud } from "@/components/overlay/OverlayHud";
import { CustomGauge } from "@/components/overlay/CustomGauge";
import { DEFAULT_APPEARANCE, FONTS, GAUGES, MAX_PRESET_BYTES, TRACES, normalizeAppearance, parsePreset, type Appearance, type AppearancePreset, type Surface } from "@/lib/customization/schema";
import { capturePreset, loadPresets, presetPatch, savePresets, THEMES } from "@/lib/customization/presets";
import { hexColor, importBackground } from "@/lib/customization/images";
import { isBrowser } from "@/lib/tauri";
import { CommunityPresets } from "./CommunityPresets";
import "@/styles/dialkit.css";
import "./customization.css";

const button = "rounded-[var(--cornerM)] border border-[var(--borderSubtle)] px-3 py-2 text-sm hover:bg-[var(--bgSurfaceHover)] focus-visible:shadow-focus-default disabled:opacity-40";
const input = "min-w-0 rounded-[var(--cornerM)] border border-[var(--borderSubtle)] bg-[var(--bgSurface)] px-3 py-2 text-sm focus-visible:shadow-focus-default";
const titleCase = (text: string) => text.replaceAll("-", " ").replace(/^./, c => c.toUpperCase());

function Preview() {
  const [actualSize, setActualSize] = useState(false);
  const host = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 80 });
  useEffect(() => {
    const measure = () => {
      if (!host.current || !content.current) return;
      const w = content.current.offsetWidth, h = content.current.offsetHeight;
      const scale = Math.max(.01, Math.min(1, (host.current.clientWidth - 24) / Math.max(1, w), 160 / Math.max(1, h)));
      setSize(old => old.scale === scale && old.height === h * scale ? old : { scale, height: h * scale });
    };
    const observer = new ResizeObserver(measure);
    if (host.current) observer.observe(host.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);
  return <>
    <div className="mb-2 flex justify-end"><button className={`${button} !py-1 text-xs`} onClick={() => setActualSize(v => !v)}>{actualSize ? "Fit preview" : "Actual size"}</button></div>
    <div ref={host} className="customization-preview" style={{ height: actualSize ? 160 : Math.max(90, size.height + 32), overflow: actualSize ? "auto" : "hidden" }}>
      <div ref={content} style={actualSize ? { width: "max-content", padding: 12 } : { position: "absolute", width: "max-content", left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${size.scale})` }}><OverlayHud /></div>
    </div>
  </>;
}

function Color({ label, value, change }: { label: string; value: string; change: (v: string) => void }) {
  return <ColorControl label={label} value={value} onChange={v => { const hex = hexColor(v); if (hex) change(hex); }} />;
}

function SurfaceEditor({ name, value, change, report }: { name: string; value: Surface; change: (v: Surface) => void; report: (error: string) => void }) {
  const [busy, setBusy] = useState(false);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; }, [value]);
  return <details className="customization-group" open>
    <summary className="focus-visible:shadow-focus-default">{name}</summary>
    <Color label="Background color" value={value.color} change={color => change({ ...value, color })} />
    <Slider label="Background opacity" value={Math.round(value.opacity * 100)} min={0} max={100} step={1} unit="%" onChange={opacity => change({ ...value, opacity: opacity / 100 })} />
    <Slider label="Corner radius" value={value.radius} min={0} max={100} step={1} unit="px" onChange={radius => change({ ...value, radius })} />
    <Slider label="Horizontal padding" value={value.paddingX} min={0} max={32} step={1} unit="px" onChange={paddingX => change({ ...value, paddingX })} />
    <Slider label="Vertical padding" value={value.paddingY} min={0} max={24} step={1} unit="px" onChange={paddingY => change({ ...value, paddingY })} />
    <label className="mt-3 block text-sm">Background image
      <input className={`${input} mt-2 block w-full`} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} aria-label={`${name} background image`} onChange={async e => {
        const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (!file) return;
        setBusy(true);
        try { const image = await importBackground(file); change({ ...latest.current, image }); }
        catch (error) { report(String(error)); } finally { setBusy(false); }
      }} />
    </label>
    <p className="mt-2 text-xs text-[var(--textSubtle)]">PNG, JPEG or WebP, up to 8 MB. Images are resized and stored with your preset.</p>
    {value.image && <div className="mt-2 flex items-center gap-3"><img src={value.image} alt={`${name} background`} className="h-12 w-20 rounded object-cover" /><button className={button} onClick={() => change({ ...value, image: "" })}>Remove image</button></div>}
  </details>;
}

export default function CustomizationEditor() {
  const settings = useSettingsStore(s => s.settings), update = useSettingsStore(s => s.updateSettings);
  const a = normalizeAppearance(settings.appearance);
  const [page, setPage] = useState("Appearance"), [name, setName] = useState("My theme"), [notice, setNotice] = useState("");
  const [presets, setPresets] = useState<AppearancePreset[]>([]);
  const [undo, setUndo] = useState<AppearancePreset | null>(null);
  useEffect(() => { try { setPresets(loadPresets()); } catch (e) { setNotice(String(e)); } }, []);
  const change = (patch: Partial<Appearance>) => update({ appearance: normalizeAppearance({ ...a, enabled: true, ...patch }) });
  const apply = (preset: AppearancePreset) => { setUndo(capturePreset("Previous appearance", settings)); update(presetPatch(preset)); setNotice(`Applied ${preset.name}.`); };
  const store = (next: AppearancePreset[]) => { savePresets(next); setPresets(next); };
  const exportPreset = async () => {
    try {
      const p = capturePreset(name, settings), text = JSON.stringify(p, null, 2);
      const filename = `${p.name.replace(/[^a-z0-9_-]/gi, "-")}.cleanmeter.json`;
      if (isBrowser) {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({ defaultPath: filename, filters: [{ name: "Cleanmeter preset", extensions: ["json"] }] });
        if (!path) return;
        const { writeTextFile } = await import("@tauri-apps/plugin-fs"); await writeTextFile(path, text);
      }
      setNotice("Preset exported.");
    } catch (e) { setNotice(String(e)); }
  };
  return <section className="customization-editor text-[var(--textHeading)]" aria-label="Overlay customization">
    <div className="sticky top-0 z-10 bg-[var(--bgSurface)] pb-3">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">Make it yours</h2><span className="text-xs text-[var(--textSubtle)]">Live preview · scaled to fit</span></div>
      <Preview />
      <div className="mt-3 flex flex-wrap gap-1" aria-label="Customization sections">
        {["Appearance", "Graphs", "Layout", "Presets", "Community"].map(p => <button key={p} className={button} aria-pressed={page === p} onClick={() => setPage(p)}>{p}</button>)}
      </div>
    </div>
    {notice && <div role="status" className="mb-3 flex items-start justify-between gap-2 rounded border border-[var(--borderSubtle)] p-3 text-sm"><span>{notice}</span><button className={button} aria-label="Dismiss message" onClick={() => setNotice("")}>×</button></div>}
    <div className="dialkit-root customization-controls" data-theme={settings.isDarkTheme ? "dark" : "light"}>
      <Toggle label="Use custom appearance" checked={a.enabled} onChange={enabled => change({ enabled })} />
      {!a.enabled && <p className="my-2 text-sm text-[var(--textSubtle)]">Your original meter style is active. Editing a style control enables customization.</p>}
      {page === "Appearance" && <>
        <details className="customization-group" open><summary className="focus-visible:shadow-focus-default">Typography</summary>
          <SelectControl label="Font family" value={a.font} options={[...FONTS]} onChange={font => change({ font: font as Appearance["font"] })} />
          <p className="text-xs text-[var(--textSubtle)]">System fonts fall back to Inter when unavailable.</p>
          <Color label="Label and unit color" value={a.labelColor} change={labelColor => change({ labelColor })} />
          <Color label="Stat color" value={a.valueColor} change={valueColor => change({ valueColor })} />
          <Slider label="Stat size" value={settings.fontSizeValue} min={8} max={24} step={1} unit="px" onChange={fontSizeValue => update({ fontSizeValue })} />
          <Slider label="Label size" value={settings.fontSizeLabel} min={8} max={18} step={1} unit="px" onChange={fontSizeLabel => update({ fontSizeLabel })} />
          <Slider label="Stat weight" value={settings.fontWeight} min={400} max={700} step={100} onChange={fontWeight => update({ fontWeight })} />
          <Slider label="Label weight" value={settings.labelFontWeight} min={400} max={700} step={100} onChange={labelFontWeight => update({ labelFontWeight })} />
        </details>
        <SurfaceEditor name="Inner pills" value={a.inner} change={inner => change({ inner })} report={setNotice} />
        <SurfaceEditor name="Outer pill" value={a.outer} change={outer => change({ outer })} report={setNotice} />
      </>}
      {page === "Graphs" && <>
        <Toggle label="Show sensor gauges" checked={settings.progressType !== "none"} onChange={show => update({ progressType: show ? "circular" : "none" })} />
        <Toggle label="Use sensor threshold colors" checked={a.thresholdColors} onChange={thresholdColors => change({ thresholdColors })} />
        <Color label="Graph accent" value={a.graphColor} change={graphColor => change({ graphColor })} />
        <h3 className="my-3 font-medium">32 gauge styles</h3>
        <div className="grid grid-cols-4 gap-2">{GAUGES.map(gauge => <button key={gauge} className={`${button} flex flex-col items-center gap-2`} aria-pressed={a.gauge === gauge} onClick={() => change({ gauge })}>
          <CustomGauge style={gauge} value={65} size={28} color={a.graphColor} /><span className="text-xs">{titleCase(gauge)}</span>
        </button>)}</div>
        <div className="mt-4"><SelectControl label="Frametime trace" value={a.trace} options={TRACES.map(value => ({ value, label: titleCase(value) }))} onChange={trace => change({ trace: trace as Appearance["trace"] })} /></div>
      </>}
      {page === "Layout" && <>
        <Toggle label="Horizontal overlay" checked={settings.isHorizontal} onChange={isHorizontal => update({ isHorizontal })} />
        <Slider label="Space between pills" value={a.gap} min={0} max={24} step={1} unit="px" onChange={gap => change({ gap })} />
        <h3 className="my-3 font-medium">Pill order</h3><p className="mb-3 text-sm text-[var(--textSubtle)]">Move stat groups into your preferred order. Hidden groups keep their place.</p>
        <ol className="space-y-2">{a.order.map((section, i) => <li key={section} className="flex items-center gap-2 rounded border border-[var(--borderSubtle)] p-2">
          <span className="mr-auto text-sm">{i + 1}. {section}</span>
          {[-1, 1].map(direction => <button key={direction} className={button} aria-label={`Move ${section} ${direction < 0 ? "earlier" : "later"}`} disabled={i + direction < 0 || i + direction >= a.order.length} onClick={() => {
            const order = [...a.order]; [order[i], order[i + direction]] = [order[i + direction], order[i]]; change({ order });
          }}>{direction < 0 ? "↑" : "↓"}</button>)}
        </li>)}</ol>
      </>}
      {page === "Presets" && <>
        <h3 className="my-3 font-medium">Ready to use</h3><div className="grid grid-cols-3 gap-2">{THEMES.map(p => <button className={`${button} text-left`} key={p.name} onClick={() => apply(p)}><div className="mb-2 flex h-12 items-center justify-center rounded" style={{ background: p.appearance.outer.color }}><CustomGauge style={p.appearance.gauge} value={70} size={24} color={p.appearance.graphColor} /></div>{p.name}</button>)}</div>
        <h3 className="mb-3 mt-6 font-medium">Your presets</h3>
        <label className="block text-sm">Preset name<input className={`${input} mt-2 w-full`} value={name} maxLength={60} onChange={e => setName(e.target.value)} /></label>
        <div className="my-3 flex gap-2"><button className={button} onClick={() => {
          try { const p = capturePreset(name, settings); if (presets.some(s => s.name === p.name)) throw new Error("That name is already saved. Choose another name or remove the old preset."); store([...presets, p]); setNotice(`Saved ${p.name}.`); } catch (e) { setNotice(String(e)); }
        }}>Save current</button><button className={button} onClick={exportPreset}>Export file</button></div>
        <label className="block text-sm">Import preset<input className={`${input} my-2 block w-full`} type="file" accept=".json" onChange={async e => {
          const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (!file) return;
          try { if (file.size > MAX_PRESET_BYTES) throw new Error("Preset files must be under 200 KB."); const p = parsePreset(JSON.parse(await file.text())); apply(p); setName(p.name); } catch (e) { setNotice(String(e)); }
        }} /></label>
        {presets.length === 0 && <p className="my-3 text-sm text-[var(--textSubtle)]">Save a look to return to it later. Local presets work offline.</p>}
        {presets.map((p, i) => <div key={p.name} className="my-2 flex items-center gap-2"><button className={`${button} grow text-left`} onClick={() => apply(p)}>{p.name}</button><button className={button} aria-label={`Delete ${p.name}`} onClick={() => { try { store(presets.filter((_, j) => i !== j)); } catch(e) { setNotice(String(e)); } }}>Delete</button></div>)}
      </>}
      {page === "Community" && <CommunityPresets current={() => capturePreset(name, settings)} apply={apply} report={setNotice} />}
    </div>
    <div className="mt-4 flex gap-2"><button className={button} onClick={() => { setUndo(capturePreset("Previous appearance", settings)); change({ ...DEFAULT_APPEARANCE }); setNotice("Original appearance restored."); }}>Restore original style</button>{undo && <button className={button} onClick={() => { update(presetPatch(undo)); setUndo(null); setNotice("Previous appearance restored."); }}>Undo</button>}</div>
  </section>;
}

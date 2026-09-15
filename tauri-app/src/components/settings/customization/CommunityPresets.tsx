import { useEffect, useState } from "react";
import { getCommunity, listCommunity, submitCommunity, type GalleryEntry } from "@/lib/customization/community";
import type { AppearancePreset } from "@/lib/customization/schema";

const button = "rounded border border-[var(--borderSubtle)] px-3 py-2 text-sm focus-visible:shadow-focus-default disabled:opacity-40";
export function CommunityPresets({ current, apply, report }: { current: () => AppearancePreset; apply: (p: AppearancePreset) => void; report: (s: string) => void }) {
  const [entries, setEntries] = useState<GalleryEntry[]>([]), [page, setPage] = useState(0), [revision, refresh] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [author, setAuthor] = useState(""), [consent, setConsent] = useState(false);
  useEffect(() => {
    let live = true;
    listCommunity(page).then(data => { if (live) { setEntries(data); setError(""); } }).catch(e => { if (live) setError(String(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, revision]);
  const navigate = (next: number) => { setLoading(true); setPage(next); };
  return <div className="mt-4 space-y-3">
    <h3 className="font-semibold">Made by the community</h3>
    <p className="text-sm text-[var(--textSubtle)]">Browse reviewed themes and apply one to your meter. Sensor selections and shortcuts stay yours.</p>
    {loading ? <p role="status">Loading presets…</p> : error ? <div role="status"><p className="text-sm">{error}</p><button className={`${button} mt-2`} onClick={() => { setLoading(true); refresh(n => n + 1); }}>Retry</button></div> : <>
      {entries.length === 0 && <p className="text-sm">No approved presets on this page yet.</p>}
      <div className="grid grid-cols-2 gap-2">{entries.map(entry => <button key={entry.id} disabled={busy} className={`${button} text-left`} onClick={async () => {
        setBusy(true); try { apply(await getCommunity(entry.id)); } catch(e) { report(String(e)); } finally { setBusy(false); }
      }}><span className="mb-2 block h-1 rounded" style={{ backgroundColor: entry.color }} /><strong className="block">{entry.name}</strong><span className="text-xs text-[var(--textSubtle)]">By {entry.author}</span></button>)}</div>
      <div className="flex items-center justify-between"><button className={button} disabled={page === 0} onClick={() => navigate(page - 1)}>Previous</button><span className="text-xs">Page {page + 1}</span><button className={button} disabled={entries.length < 12} onClick={() => navigate(page + 1)}>Next</button></div>
    </>}
    <details className="customization-group"><summary className="focus-visible:shadow-focus-default">Share your current theme</summary>
      <p className="mb-3 text-sm">Your theme name, display name, appearance settings and any background images will be sent for review and may be published for anyone to download. Hardware data is not included. Set the theme name under Presets first.</p>
      <label className="block text-sm">Public display name<input className="my-2 block w-full rounded border border-[var(--borderSubtle)] bg-[var(--bgSurface)] p-2 focus-visible:shadow-focus-default" maxLength={40} value={author} onChange={e => setAuthor(e.target.value)} /></label>
      <label className="my-3 flex items-start gap-2 text-sm"><input className="mt-1 focus-visible:shadow-focus-default" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I have permission to share these images and agree to publish this preset.</label>
      <button className={button} disabled={busy || !consent || !author.trim()} onClick={async () => {
        setBusy(true); try { await submitCommunity(current(), author.trim()); report("Submitted for review. Your theme will appear after approval."); setConsent(false); } catch(e) { report(String(e)); } finally { setBusy(false); }
      }}>Submit for review</button>
    </details>
  </div>;
}

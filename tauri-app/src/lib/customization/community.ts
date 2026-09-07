import { isBrowser } from "../tauri";
import { MAX_PRESET_BYTES, parsePreset, type AppearancePreset } from "./schema";

export interface GalleryEntry { id: string; name: string; author: string; color: string; }
async function request(action: "list" | "get" | "submit", args: { id?: string; page?: number; preset?: unknown } = {}): Promise<unknown> {
  if (!isBrowser) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("community_presets", { action, ...args });
  }
  const base = import.meta.env.VITE_COMMUNITY_URL;
  if (!base) throw new Error("Community preview is not configured. Local presets are available offline.");
  const url = new URL(action === "get" ? `/api/presets/${args.id}` : "/api/presets", base);
  if (action === "list") url.searchParams.set("page", String(args.page ?? 0));
  const response = await fetch(url, { method: action === "submit" ? "POST" : "GET", headers: action === "submit" ? { "Content-Type": "application/json" } : undefined, body: action === "submit" ? JSON.stringify(args.preset) : undefined, signal: AbortSignal.timeout(20000), credentials: "omit" });
  if (!response.ok) throw new Error(response.status === 429 ? "Please wait before submitting again." : "Community gallery unavailable. Try again later.");
  const text = await response.text();
  if (text.length > MAX_PRESET_BYTES + 50000) throw new Error("Community response too large.");
  return JSON.parse(text);
}
export async function listCommunity(page: number): Promise<GalleryEntry[]> {
  const data = await request("list", { page });
  if (!Array.isArray(data) || data.length > 12) throw new Error("Invalid gallery response.");
  return data.map(entry => {
    if (!entry || typeof entry.id !== "string" || !/^[0-9a-f-]{36}$/i.test(entry.id) || typeof entry.name !== "string" || entry.name.length > 60 || typeof entry.author !== "string" || entry.author.length > 40) throw new Error("Invalid gallery entry.");
    return { id: entry.id, name: entry.name, author: entry.author, color: /^#[0-9a-f]{6}$/i.test(entry.color) ? entry.color : "#74dfa2" };
  });
}
export async function getCommunity(id: string) { return parsePreset(await request("get", { id })); }
export async function submitCommunity(preset: AppearancePreset, author: string) { await request("submit", { preset: { preset: parsePreset(preset), author } }); }

import { MAX_IMAGE_CHARS } from "./schema";

/** Decode and re-encode raster uploads; do not keep arbitrary file paths/URLs. */
export async function importBackground(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error("Choose a PNG, JPEG or WebP image up to 8 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await image.decode();
    if (!image.width || !image.height || image.width * image.height > 24_000_000) throw new Error("Choose an image smaller than 24 megapixels.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image conversion is unavailable.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.85, .65, .4, .2]) {
      const result = canvas.toDataURL("image/webp", quality);
      if (result.length <= MAX_IMAGE_CHARS) return result;
    }
    throw new Error("This image is too detailed. Choose a smaller or simpler background.");
  } finally { URL.revokeObjectURL(url); }
}

// DialKit accepts several CSS color formats. Persist a portable opaque hex
// value; surface opacity has its own independent control.
export function hexColor(css: string): string | null {
  if (css.length > 100 || !CSS.supports("color", css)) return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
  const bytes = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [...bytes].slice(0, 3).map(n => n.toString(16).padStart(2, "0")).join("");
}

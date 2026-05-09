export function initialsFor(firstName?: string | null, lastName?: string | null, fallback?: string | null): string {
  const f = (firstName ?? "").trim();
  const l = (lastName ?? "").trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  const fb = (fallback ?? "").trim();
  if (fb) {
    const parts = fb.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return fb.slice(0, 2).toUpperCase();
  }
  return "??";
}

const PALETTE = [
  ["bg-rose-500/90", "text-white"],
  ["bg-amber-500/90", "text-white"],
  ["bg-emerald-500/90", "text-white"],
  ["bg-sky-500/90", "text-white"],
  ["bg-indigo-500/90", "text-white"],
  ["bg-violet-500/90", "text-white"],
  ["bg-fuchsia-500/90", "text-white"],
  ["bg-teal-500/90", "text-white"],
  ["bg-orange-500/90", "text-white"],
  ["bg-cyan-500/90", "text-white"],
] as const;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorFor(seed: string): { bg: string; fg: string } {
  const [bg, fg] = PALETTE[hash(seed || "anon") % PALETTE.length];
  return { bg, fg };
}

export async function cropImageToSquareDataURL(
  file: File,
  size = 256,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.88,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2;
  const sy = (bitmap.height - min) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL(mime, quality);
}

export async function cropImageWithTransformToDataURL(
  src: HTMLImageElement,
  zoom: number,
  offsetX: number,
  offsetY: number,
  size = 256,
  mime: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.88,
): Promise<string> {
  const naturalMin = Math.min(src.naturalWidth, src.naturalHeight);
  const cropSize = naturalMin / zoom;
  const cx = src.naturalWidth / 2 - offsetX * (src.naturalWidth - cropSize);
  const cy = src.naturalHeight / 2 - offsetY * (src.naturalHeight - cropSize);
  const sx = Math.max(0, Math.min(src.naturalWidth - cropSize, cx - cropSize / 2));
  const sy = Math.max(0, Math.min(src.naturalHeight - cropSize, cy - cropSize / 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, sx, sy, cropSize, cropSize, 0, 0, size, size);
  return canvas.toDataURL(mime, quality);
}

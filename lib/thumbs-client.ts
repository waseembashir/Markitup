import { createBrowserSupabase } from "@/lib/supabase/client";
import { THUMB_WIDTH, THUMB_MAX_HEIGHT, thumbPathFor } from "@/lib/thumbs";

// Browser half of the previews (see lib/thumbs.ts): draw the top of an image
// into a small canvas and store it beside the original.

type Drawable = HTMLImageElement | ImageBitmap;

function sizeOf(src: Drawable) {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

export function drawThumb(src: Drawable): Promise<Blob | null> {
  const { w, h } = sizeOf(src);
  if (!w || !h) return Promise.resolve(null);
  const outW = Math.min(THUMB_WIDTH, w);
  const scale = outW / w;
  const outH = Math.max(1, Math.round(Math.min(h * scale, THUMB_MAX_HEIGHT)));
  const srcH = Math.round(outH / scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, srcH, 0, 0, outW, outH);
  return new Promise((resolve) => {
    try {
      // Browsers that can't encode WebP hand back PNG instead, which is far
      // larger; fall back to JPEG then.
      canvas.toBlob((b) => {
        if (b && b.type === "image/webp") return resolve(b);
        canvas.toBlob((j) => resolve(j), "image/jpeg", 0.82);
      }, "image/webp", 0.8);
    } catch {
      // A canvas tainted by an image served without CORS can't be read.
      resolve(null);
    }
  });
}

export async function thumbFromFile(file: Blob): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    try {
      return await drawThumb(bmp);
    } finally {
      bmp.close();
    }
  } catch {
    return null;
  }
}

// Best-effort: a missing preview only means the card shows the original.
// Never overwrites — whoever stores one first wins, and theirs is as good.
export async function saveThumb(filePath: string, thumb: Blob | null): Promise<boolean> {
  if (!thumb) return false;
  try {
    const { error } = await createBrowserSupabase()
      .storage.from("mockups")
      .upload(thumbPathFor(filePath), thumb, { contentType: thumb.type, cacheControl: "86400", upsert: false });
    return !error;
  } catch {
    return false;
  }
}

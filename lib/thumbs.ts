import type { SupabaseClient } from "@supabase/supabase-js";

// Card covers used to be the original upload — a full-page design, often
// several megabytes — scaled down by the browser. A grid of them downloaded
// tens of megabytes to draw a few small rectangles. Each image file now gets a
// small preview stored beside it, made in the browser: at upload, or the first
// time a teammate's browser loads a file that predates this.
//
// The preview's path is derived from the file's, so no database column is
// needed, and it sits under the same project folder so the storage policies
// that guard the file guard its preview too.

export const THUMB_WIDTH = 640;
// Designs are often whole pages; cards only ever show the top, so keep only that.
export const THUMB_MAX_HEIGHT = 960;

export function thumbPathFor(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  const dir = filePath.slice(0, slash);
  const base = filePath.slice(slash + 1).replace(/\.[^.]+$/, "");
  return `${dir}/thumbs/${base}.webp`;
}

export type SignedFile = { url?: string; thumbUrl?: string };

// A signed URL carries a fresh token every time it is minted, so a page that
// signs on every render hands the browser a new address for every image on
// every visit, and nothing is ever served from its cache. Reuse a signature
// while it has comfortably more life left than any page will need.
//
// Keyed by path only, which is safe because a path only reaches here after the
// caller's own RLS-checked query returned it: whoever is asking may see it.
const SIGN_FOR = 6 * 60 * 60; // seconds
const REUSE_FOR = 5 * 60 * 60 * 1000; // ms — leaves at least an hour on any URL handed out
const cache = new Map<string, { url: string | null; at: number }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function signPaths(supabase: SupabaseClient<any>, paths: string[]): Promise<Map<string, string | null>> {
  const now = Date.now();
  const out = new Map<string, string | null>();
  const missing: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(p);
    if (hit && now - hit.at < REUSE_FOR) out.set(p, hit.url);
    else missing.push(p);
  }
  if (missing.length) {
    if (cache.size > 20_000) cache.clear(); // one entry per file; never let it grow without bound
    const { data } = await supabase.storage.from("mockups").createSignedUrls(missing, SIGN_FOR);
    for (const row of data ?? []) {
      if (!row.path) continue;
      const url = row.signedUrl ?? null;
      out.set(row.path, url);
      // A preview that doesn't exist yet is remembered only briefly, so one
      // made a moment later is picked up on the next visit.
      cache.set(row.path, { url, at: url ? now : now - REUSE_FOR + 60_000 });
    }
  }
  return out;
}

// Sign each file and, for images, its preview — in one round trip.
export async function signFilesWithThumbs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  files: { path: string; isHtml?: boolean }[],
): Promise<Map<string, SignedFile>> {
  const result = new Map<string, SignedFile>();
  if (!files.length) return result;
  const thumbOf = new Map(files.filter((f) => !f.isHtml).map((f) => [f.path, thumbPathFor(f.path)]));
  const signed = await signPaths(supabase, [...files.map((f) => f.path), ...thumbOf.values()]);
  for (const f of files) {
    const t = thumbOf.get(f.path);
    result.set(f.path, {
      url: signed.get(f.path) ?? undefined,
      thumbUrl: t ? signed.get(t) ?? undefined : undefined,
    });
  }
  return result;
}

// Forget a path's signature, for a file just replaced or removed.
export function forgetSigned(path: string) {
  cache.delete(path);
}

// Test hook.
export function __clearSignCache() {
  cache.clear();
}

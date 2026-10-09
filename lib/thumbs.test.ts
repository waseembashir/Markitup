import { describe, it, expect, vi, beforeEach } from "vitest";
import { thumbPathFor, signFilesWithThumbs, forgetSigned, __clearSignCache } from "./thumbs";

function fakeSupabase(existing: Set<string>) {
  const createSignedUrls = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl: existing.has(path) ? `https://s/${path}?token=${Math.random()}` : null,
      error: existing.has(path) ? null : "Either the object does not exist or you do not have access to it",
    })),
    error: null,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = { storage: { from: () => ({ createSignedUrls }) } } as any;
  return { supabase, createSignedUrls };
}

describe("thumbPathFor", () => {
  it("keeps the preview inside the project's folder, so the same storage rules guard it", () => {
    expect(thumbPathFor("p1/abc.png")).toBe("p1/thumbs/abc.webp");
    expect(thumbPathFor("p1/abc.jpg")).toBe("p1/thumbs/abc.webp");
  });
});

describe("signFilesWithThumbs", () => {
  beforeEach(() => __clearSignCache());

  it("signs files and their previews in one round trip, and skips previews for HTML", async () => {
    const { supabase, createSignedUrls } = fakeSupabase(new Set(["p/a.png", "p/thumbs/a.webp", "p/b.html"]));
    const out = await signFilesWithThumbs(supabase, [{ path: "p/a.png" }, { path: "p/b.html", isHtml: true }]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["p/a.png", "p/b.html", "p/thumbs/a.webp"]);
    expect(out.get("p/a.png")?.thumbUrl).toContain("p/thumbs/a.webp");
    expect(out.get("p/b.html")?.thumbUrl).toBeUndefined();
  });

  it("leaves thumbUrl empty when a file has no preview yet, so the card shows the original", async () => {
    const { supabase } = fakeSupabase(new Set(["p/a.png"]));
    const out = await signFilesWithThumbs(supabase, [{ path: "p/a.png" }]);
    expect(out.get("p/a.png")?.url).toBeTruthy();
    expect(out.get("p/a.png")?.thumbUrl).toBeUndefined();
  });

  it("hands out the same URL on the next visit, so the browser can serve it from cache", async () => {
    const { supabase, createSignedUrls } = fakeSupabase(new Set(["p/a.png", "p/thumbs/a.webp"]));
    const first = await signFilesWithThumbs(supabase, [{ path: "p/a.png" }]);
    const second = await signFilesWithThumbs(supabase, [{ path: "p/a.png" }]);
    expect(second.get("p/a.png")).toEqual(first.get("p/a.png"));
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
  });

  it("signs afresh once a path is forgotten", async () => {
    const { supabase, createSignedUrls } = fakeSupabase(new Set(["p/a.png", "p/thumbs/a.webp"]));
    await signFilesWithThumbs(supabase, [{ path: "p/a.png" }]);
    forgetSigned("p/thumbs/a.webp");
    await signFilesWithThumbs(supabase, [{ path: "p/a.png" }]);
    expect(createSignedUrls).toHaveBeenCalledTimes(2);
    expect(createSignedUrls.mock.calls[1][0]).toEqual(["p/thumbs/a.webp"]);
  });
});

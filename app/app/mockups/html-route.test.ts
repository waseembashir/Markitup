import { describe, it, expect, vi, beforeEach } from "vitest";
import { injectHeightReporter, stripHeightReporter, HTML_HEIGHT_MESSAGE } from "@/lib/html-embed";

const maybeSingle = vi.fn();
const createSignedUrl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    storage: { from: () => ({ createSignedUrl }) },
  }),
}));

// The design as it sits in storage: the uploader already injected a reporter,
// and the page has scripts and inlined images of its own.
const STORED = injectHeightReporter(
  `<!doctype html><html><body>` +
    `<script>window.hero=1</script>` +
    `<img src="data:image/png;base64,${"A".repeat(2000)}">` +
    `<p>Take your practice to the next level</p>` +
    `</body></html>`,
);

function streamOf(text: string, chunk = 64) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += chunk) c.enqueue(bytes.slice(i, i + chunk));
      c.close();
    },
  });
}

async function get(url = "http://app.test/app/mockups/m1/html") {
  const { GET } = await import("./[mockupId]/html/route");
  const { NextRequest } = await import("next/server");
  return GET(new NextRequest(url), { params: Promise.resolve({ mockupId: "m1" }) });
}

describe("serving an uploaded HTML design", () => {
  beforeEach(() => {
    maybeSingle.mockClear();
    createSignedUrl.mockClear();
    maybeSingle.mockResolvedValue({ data: { file_path: "proj/file.html", type: "html" } });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.test/file.html" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(streamOf(STORED), { status: 200 }) as Response,
    );
  });

  it("serves it as HTML so the browser renders it instead of showing source", async () => {
    const res = await get();
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("sandboxes the document even if the URL is opened directly", async () => {
    const csp = (await get()).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("sandbox");
    expect(csp).toContain("allow-scripts");
    // Same-origin access would make a client's uploaded page our XSS problem.
    expect(csp).not.toContain("allow-same-origin");
  });

  it("swaps the uploader's reporter for the current one, keeping the page intact", async () => {
    const body = await (await get()).text();
    // Exactly one reporter, and the page's own script and content survive.
    expect(body).toContain(HTML_HEIGHT_MESSAGE);
    // Exactly one reporter: stripping it leaves no trace of another.
    expect(stripHeightReporter(body)).not.toContain(HTML_HEIGHT_MESSAGE);
    expect(body).toContain("window.hero=1");
    expect(body).toContain("Take your practice to the next level");
    expect(body).toContain("data:image/png;base64,AAAA");
  });

  it("leaves the reporter out for compare, which listens for nothing", async () => {
    const body = await (await get("http://app.test/app/mockups/m1/html?bare=1")).text();
    expect(body).not.toContain(HTML_HEIGHT_MESSAGE);
    expect(body).toContain("window.hero=1");
  });

  it("gives nothing away about a file the viewer cannot see", async () => {
    // RLS returns no row rather than an error for someone without access.
    maybeSingle.mockResolvedValue({ data: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("answers inside the frame when storage refuses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 403 }) as Response);
    const res = await get();
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("couldn’t be loaded");
  });
});

import { describe, it, expect } from "vitest";
import { injectHeightReporter, stripHeightReporter, createReporterStripper, HTML_HEIGHT_MESSAGE } from "./html-embed";

describe("html-embed reporter", () => {
  it("injects the reporter before </body>", () => {
    const out = injectHeightReporter("<html><body><h1>Hi</h1></body></html>");
    expect(out).toContain(HTML_HEIGHT_MESSAGE);
    expect(out.indexOf(HTML_HEIGHT_MESSAGE)).toBeLessThan(out.indexOf("</body>"));
  });

  it("appends the reporter when there is no </body>", () => {
    const out = injectHeightReporter("<h1>Hi</h1>");
    expect(out.startsWith("<h1>Hi</h1>")).toBe(true);
    expect(out).toContain(HTML_HEIGHT_MESSAGE);
  });

  it("strips only the reporter, preserving other scripts and the markup between them", () => {
    const page =
      '<html><body><script>window.analytics=1</script><main>content</main>';
    const injected = injectHeightReporter(page + "</body></html>");
    const stripped = stripHeightReporter(injected);
    // reporter gone…
    expect(stripped).not.toContain(HTML_HEIGHT_MESSAGE);
    // …but the page's own script and content survive intact
    expect(stripped).toContain("window.analytics=1");
    expect(stripped).toContain("<main>content</main>");
    expect(stripped).toContain("</body>");
  });

  it("strip + re-inject yields a single reporter (idempotent at view time)", () => {
    const once = injectHeightReporter("<body><p>x</p></body>");
    const twice = injectHeightReporter(stripHeightReporter(once));
    const count = twice.split(HTML_HEIGHT_MESSAGE).length - 1;
    expect(count).toBe(1);
  });

  it("does not corrupt a page whose script precedes the reporter", () => {
    const page = "<body><script>var a='</scriptish>';doStuff()</script><h1>Title</h1></body>";
    const injected = injectHeightReporter(page);
    const stripped = stripHeightReporter(injected);
    expect(stripped).toContain("<h1>Title</h1>");
    expect(stripped).toContain("doStuff()");
    expect(stripped).not.toContain(HTML_HEIGHT_MESSAGE);
  });
});

// The route streams an uploaded page instead of reading it into one string, so
// the stale reporter has to be found across chunk boundaries.
describe("createReporterStripper", () => {
  const run = (chunks: string[]) => {
    const s = createReporterStripper();
    return chunks.map((c) => s.push(c)).join("") + s.flush();
  };

  it("matches stripHeightReporter when the document arrives in one piece", () => {
    const html = injectHeightReporter("<html><body><p>hi</p></body></html>");
    expect(run([html])).toBe(stripHeightReporter(html));
  });

  it("drops a reporter split across chunks", () => {
    const html = injectHeightReporter("<html><body><p>hi</p></body></html>");
    const chunks = [];
    for (let i = 0; i < html.length; i += 97) chunks.push(html.slice(i, i + 97));
    expect(run(chunks)).toBe(stripHeightReporter(html));
  });

  it("keeps the page's own scripts, in order, even next to the reporter", () => {
    const page = `<body><script>first()</script><p>x</p><script src="/a.js"></script></body>`;
    const out = run([injectHeightReporter(page)]);
    expect(out).toContain("first()");
    expect(out).toContain('<script src="/a.js"></script>');
    expect(out.indexOf("first()")).toBeLessThan(out.indexOf("/a.js"));
    expect(out).not.toContain(HTML_HEIGHT_MESSAGE);
  });

  it("survives a chunk boundary inside the opening tag", () => {
    const html = injectHeightReporter("<body><p>hi</p></body>");
    const cut = html.indexOf("<script") + 3;
    expect(run([html.slice(0, cut), html.slice(cut)])).toBe(stripHeightReporter(html));
  });

  it("passes a page with no scripts straight through without buffering it", () => {
    const img = `<body><img src="data:image/png;base64,${"A".repeat(5000)}"></body>`;
    expect(run([img])).toBe(img);
  });
});

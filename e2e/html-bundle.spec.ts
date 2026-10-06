import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { createReporterStripper, reporterInsertionPoint, HEIGHT_REPORTER_SCRIPT } from "../lib/html-embed";

/**
 * Commenting on an uploaded design, across the two shapes a design arrives in.
 *
 * In October the agency's exports stopped being pages: each is a bundle, every
 * page of a site held as a string in one wrapper, written into a nested
 * <iframe srcdoc> by a small router. Clients were looking at that inner
 * document, the reporter was in the wrapper, and so every click landed
 * somewhere nothing was listening — no pin, no error, nothing on the server to
 * find. jsdom cannot see a bug made of real frames and real origins, which is
 * why this one is driven in a browser.
 *
 * Self-contained: it serves its own fixtures and never touches the app or the
 * database. The sandbox and headers match what the route sends.
 */

const SANDBOX = "allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-pointer-lock";

const INNER = `<!doctype html><html><head><title>inner</title></head>
<body style="margin:0"><div style="height:2400px;background:linear-gradient(#fff,#ddd)">
<h1 style="margin:0;padding:40px">The real page</h1></div></body></html>`;

// A page that is a page.
const PLAIN = `<!doctype html><html><head><title>plain</title></head>
<body style="margin:0"><div style="height:1800px">Plain page</div></body></html>`;

// A page that is a wrapper around the page, which is what a bundle is.
const BUNDLE = `<!doctype html><html><head><title>bundle</title>
<style>html,body{margin:0;height:100%}#view{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
</head><body><iframe id="view" title="view"></iframe>
<script>document.getElementById("view").srcdoc = ${JSON.stringify(INNER)};</script>
</body></html>`;

// A page of its own that happens to embed a small frame: its height is its own.
const WITH_WIDGET = `<!doctype html><html><head><title>widget</title></head>
<body style="margin:0"><div style="height:1500px">Host page</div>
<iframe id="w" style="width:300px;height:200px;border:0"></iframe>
<script>document.getElementById("w").srcdoc = ${JSON.stringify(INNER)};</script>
</body></html>`;

/** What the route serves for a stored file. */
function served(stored: string) {
  const stripper = createReporterStripper();
  let out = "";
  for (let i = 0; i < stored.length; i += 4096) out += stripper.push(stored.slice(i, i + 4096));
  out += stripper.flush();
  const at = reporterInsertionPoint(out.slice(0, 65536), true) ?? 0;
  return out.slice(0, at) + HEIGHT_REPORTER_SCRIPT + out.slice(at);
}

const PAGES: Record<string, string> = { bundle: BUNDLE, plain: PLAIN, widget: WITH_WIDGET };

let server: Server;
let origin: string;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const which = new URL(req.url ?? "/", "http://x").searchParams.get("page") ?? "plain";
    if (req.url?.startsWith("/design")) {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-security-policy": "sandbox " + SANDBOX,
      });
      res.end(served(PAGES[which]));
      return;
    }
    // The viewer's side: the frame it owns, and a listener like its own.
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><body style="margin:0">
      <iframe id="f" src="/design?page=${which}" sandbox="${SANDBOX}" style="width:1200px;height:800px;border:0"></iframe>
      <script>
        window.msgs = [];
        addEventListener("message", (e) => {
          if (e.source !== document.getElementById("f").contentWindow) return;
          if (e.data && e.data.type) window.msgs.push(e.data);
        });
      </script>`);
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  origin = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(() => server?.close());

async function open(page: import("@playwright/test").Page, which: string) {
  await page.setViewportSize({ width: 1260, height: 860 });
  await page.goto(`${origin}/?page=${which}`);
  await page.waitForFunction(() => (window as never as { msgs: unknown[] }).msgs.length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
}

const heightOf = (msgs: { type: string; height?: number }[]) =>
  msgs.filter((m) => m.type === "markitup:height").pop()?.height ?? 0;

async function clickAndCatchPointer(page: import("@playwright/test").Page, x: number, y: number) {
  await page.evaluate(() =>
    (document.getElementById("f") as HTMLIFrameElement).contentWindow!.postMessage(
      { type: "markitup:mode", mode: "comment" }, "*"),
  );
  await page.waitForTimeout(300);
  await page.mouse.click(x, y);
  await page.waitForTimeout(800);
  return page.evaluate(
    () => (window as never as { msgs: { type: string; x?: number; y?: number }[] }).msgs
      .filter((m) => m.type === "markitup:pointer").pop() ?? null,
  );
}

test("a click reaches the viewer through a bundle's nested frame", async ({ page }) => {
  await open(page, "bundle");
  const pointer = await clickAndCatchPointer(page, 500, 300);
  expect(pointer, "no pointer reached the viewer — the design cannot be commented on").not.toBeNull();
  expect(Math.round(pointer!.x!)).toBe(500);
  expect(Math.round(pointer!.y!)).toBe(300);
});

test("a bundle is measured by the page inside it, not by its wrapper", async ({ page }) => {
  await open(page, "bundle");
  const msgs = await page.evaluate(() => (window as never as { msgs: never[] }).msgs);
  // The wrapper is a fixed viewport; the design is 2400px tall.
  expect(heightOf(msgs)).toBeGreaterThan(2000);
});

test("an ordinary page is unchanged", async ({ page }) => {
  await open(page, "plain");
  const msgs = await page.evaluate(() => (window as never as { msgs: never[] }).msgs);
  expect(heightOf(msgs)).toBeGreaterThan(1700);
  const pointer = await clickAndCatchPointer(page, 400, 250);
  expect(pointer).not.toBeNull();
});

test("a page with a small embedded frame keeps its own height", async ({ page }) => {
  await open(page, "widget");
  const msgs = await page.evaluate(() => (window as never as { msgs: never[] }).msgs);
  // 1500px host, not the 2400px widget it embeds.
  expect(heightOf(msgs)).toBeGreaterThan(1400);
  expect(heightOf(msgs)).toBeLessThan(2000);
});

"use client";

import { useEffect, useRef, useState } from "react";

// A live, scaled-down preview of an uploaded HTML page for card covers.
// Renders the top of the page in a fully sandboxed iframe (scripts OFF — CSS and
// layout only, so it stays light even with many previews on a grid) scaled to
// fit the card width. The page is fetched as text and shown via srcdoc because
// storage serves .html as text/plain.
//
// The fetch is deferred until the card is near the viewport, so a grid of many
// HTML mockups doesn't kick off dozens of large downloads at once (the old
// behaviour, which made grids load slowly and starve the browser's connections).
const DESIGN_W = 1280;

export function HtmlThumbnail({ url, className = "" }: { url: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reveal (and start fetching) only when the preview scrolls near the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (older browser, jsdom): show it immediately rather
    // than never. Can't be derived during render — the check is client-only, so
    // doing it there would desync from the server's markup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    const ctrl = new AbortController();
    // Give a slow/hung storage response a bound so the skeleton doesn't hang.
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch(url, { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((t) => { if (alive) setDoc(t); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, [visible, url]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / DESIGN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ready = !!doc && scale > 0;
  return (
    <div ref={ref} className={`relative overflow-hidden bg-white ${className}`}>
      {!ready && !failed && <div className="skeleton absolute inset-0 !rounded-none" />}
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-canvas text-faint">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9.5 13.5 8 15l1.5 1.5M14.5 13.5 16 15l-1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {ready && (
        <iframe
          srcDoc={doc}
          title="HTML preview"
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden
          className="media-in"
          style={{
            width: DESIGN_W,
            height: DESIGN_W,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

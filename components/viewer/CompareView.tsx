"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CompareComments, type CompareCommentGroup } from "./CompareComments";
import { PinMarker } from "./PinMarker";
import type { ViewerPin } from "./MockupViewer";
import { stripHeightReporter } from "@/lib/html-embed";

export type CompareMockup = { id: string; name: string; url: string; version?: number; isHtml?: boolean };

// An uploaded HTML page renders as a live frame that scrolls internally, rather
// than a flat image. Pins aren't drawn over it: their coordinates are normalized
// to the page's full scroll height, which this unscaled frame doesn't reproduce,
// so they would land in the wrong places. Open the file itself to see them.
function HtmlPane({ m }: { m: CompareMockup }) {
  const [doc, setDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Pointing an iframe at the storage URL showed the page's SOURCE instead of the
  // page: Supabase doesn't serve these to render inline, whatever content type
  // they were stored with. Fetch the file and hand it to the frame directly, the
  // same way the main viewer does — the caller keys this component by url, so a
  // version switch remounts it rather than needing a synchronous state reset.
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    fetch(m.url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      // Drop the height reporter the uploader injected: compare draws no pins,
      // so nothing here listens for what it posts.
      .then((text) => { if (alive) setDoc(stripHeightReporter(text)); })
      .catch((e) => { if (alive && e?.name !== "AbortError") setFailed(true); });
    return () => { alive = false; ctrl.abort(); };
  }, [m.url]);

  if (failed) {
    return (
      <div className="grid h-full place-items-center rounded-lg bg-canvas text-sm text-faint">
        Couldn&apos;t load this page.
      </div>
    );
  }
  if (doc === null) {
    return (
      <div className="grid h-full place-items-center rounded-lg bg-canvas text-sm text-faint">
        Loading page…
      </div>
    );
  }
  return (
    <iframe
      srcDoc={doc}
      title={m.name}
      sandbox="allow-scripts allow-popups allow-forms allow-modals"
      referrerPolicy="no-referrer"
      className="block h-full w-full rounded-lg border-0 bg-white shadow-lg ring-1 ring-border"
    />
  );
}

// Pins overlaid on a compare image, positioned by their normalized x/y.
function PinOverlay({ pins, openPin, onPinClick }: { pins: ViewerPin[]; openPin: string | null; onPinClick: (id: string) => void }) {
  return (
    <>
      {pins.map((p) => (
        <PinMarker
          key={p.id}
          number={p.number}
          x={p.x}
          y={p.y}
          status={p.status}
          selected={openPin === p.id}
          onClick={() => onPinClick(p.id)}
        />
      ))}
    </>
  );
}

function label(m?: CompareMockup) {
  if (!m) return "";
  return m.version ? `Version ${m.version}` : m.name;
}

const CompareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

// ---- Side-by-side (classic) ----------------------------------------------
function Panel({
  value,
  onChange,
  mockups,
  scrollRef,
  onScroll,
  side,
  pins,
  openPin,
  onPinClick,
}: {
  value: string;
  onChange: (id: string) => void;
  mockups: CompareMockup[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  side: "Previous" | "Latest";
  pins: ViewerPin[];
  openPin: string | null;
  onPinClick: (id: string) => void;
}) {
  const m = mockups.find((x) => x.id === value);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-ink" title="Comparison view">
          <CompareIcon />
        </span>
        <span className="shrink-0 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">{side}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-8 min-w-0 flex-1 text-sm">
          {mockups.map((x) => (
            <option key={x.id} value={x.id}>{label(x)} · {x.name}</option>
          ))}
        </select>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`min-h-0 flex-1 bg-canvas ${m?.isHtml ? "overflow-hidden p-2" : "overflow-auto p-4"}`}
      >
        {!m?.url ? (
          <div className="grid h-full place-items-center text-sm text-faint">No preview.</div>
        ) : m.isHtml ? (
          <HtmlPane key={m.url} m={m} />
        ) : (
          <div className="relative mx-auto w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.name} className="block w-full rounded-lg shadow-lg ring-1 ring-border" />
            <PinOverlay pins={pins} openPin={openPin} onPinClick={onPinClick} />
          </div>
        )}
      </div>
    </div>
  );
}

export function CompareView({
  mockups,
  initialLeft,
  initialRight,
  projectId,
  projectName,
  commentGroups = [],
}: {
  mockups: CompareMockup[];
  initialLeft: string; // previous / old
  initialRight: string; // latest / new
  projectId: string;
  projectName: string;
  commentGroups?: CompareCommentGroup[];
}) {
  const [mode, setMode] = useState<"overlay" | "side">("overlay");
  const [newId, setNewId] = useState(initialRight);
  const [oldId, setOldId] = useState(initialLeft);
  const [peek, setPeek] = useState(false);
  const [synced, setSynced] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [openPin, setOpenPin] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const newM = mockups.find((m) => m.id === newId);
  const oldM = mockups.find((m) => m.id === oldId);

  const pinsFor = (id?: string) => commentGroups.find((g) => g.key === id)?.pins ?? [];
  const togglePin = (id: string) => setOpenPin((o) => (o === id ? null : id));

  // Hold Space to peek at the old version (ignored while a form control is focused).
  useEffect(() => {
    if (mode !== "overlay") return;
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !isField(e.target)) { e.preventDefault(); setPeek(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); setPeek(false); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      setPeek(false);
    };
  }, [mode]);

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  const ModeToggle = (
    <div className="flex overflow-hidden rounded-md border">
      <button
        onClick={() => setMode("overlay")}
        className="px-3 py-1 text-xs font-semibold transition-colors"
        style={mode === "overlay" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
      >
        Overlay
      </button>
      <button
        onClick={() => setMode("side")}
        className="border-l px-3 py-1 text-xs font-semibold transition-colors"
        style={mode === "side" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
      >
        Side by side
      </button>
    </div>
  );

  // side-by-side synced scroll
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  function sync(from: "l" | "r") {
    if (!synced || lock.current) return;
    const src = (from === "l" ? leftRef : rightRef).current;
    const dst = (from === "l" ? rightRef : leftRef).current;
    if (!src || !dst) return;
    lock.current = true;
    const ry = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    const rx = src.scrollLeft / Math.max(1, src.scrollWidth - src.clientWidth);
    dst.scrollTop = ry * (dst.scrollHeight - dst.clientHeight);
    dst.scrollLeft = rx * (dst.scrollWidth - dst.clientWidth);
    requestAnimationFrame(() => { lock.current = false; });
  }

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-canvas">
      {/* one minimal header: back · title · controls */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <Link
          href={`/app/projects/${projectId}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
          aria-label="Back to project"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="truncate text-sm font-bold text-ink">Compare · {projectName}</h1>

        <div className="ml-auto flex items-center gap-2">
          {mode === "overlay" && (
            <button
              onPointerDown={(e) => { e.preventDefault(); setPeek(true); }}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              className="btn-secondary btn-sm select-none gap-2"
              title="Hold (or press Space) to see the old version"
            >
              <CompareIcon />
              {peek ? "Showing old…" : "Hold to compare"}
            </button>
          )}
          {mode === "side" && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
              <input type="checkbox" checked={synced} onChange={(e) => setSynced(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
              Sync scroll
            </label>
          )}
          <button onClick={toggleFull} aria-label="Fullscreen" title="Fullscreen" className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            aria-label={showComments ? "Hide comments" : "Show comments"}
            title={showComments ? "Hide comments" : "Show comments"}
            className="grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-[color:var(--accent)]"
            style={showComments ? { background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" } : { color: "var(--color-muted)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </button>
          {ModeToggle}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {showComments && (
          <aside className="w-80 shrink-0 border-r">
            <CompareComments groups={commentGroups} openPin={openPin} onOpenPin={setOpenPin} />
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">

      {mode === "overlay" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-canvas p-3">
          {/* full-size: fills the available width, same as the normal viewer */}
          <div className="relative mx-auto w-full">
            {newM?.url && (
              <div className="relative" style={{ opacity: peek ? 0 : 1, pointerEvents: peek ? "none" : "auto" }}>
                {newM.isHtml ? (
                  <div className="h-[calc(100vh-8rem)]"><HtmlPane key={newM.url} m={newM} /></div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newM.url} alt="" className="block w-full rounded-lg shadow-lg ring-1 ring-border" />
                    <PinOverlay pins={pinsFor(newM.id)} openPin={openPin} onPinClick={togglePin} />
                  </>
                )}
              </div>
            )}
            {oldM?.url && (
              <div className="absolute inset-x-0 top-0" style={{ opacity: peek ? 1 : 0, pointerEvents: peek ? "auto" : "none" }}>
                <div className="relative">
                  {oldM.isHtml ? (
                    <div className="h-[calc(100vh-8rem)]"><HtmlPane key={oldM.url} m={oldM} /></div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={oldM.url} alt="" className="block w-full rounded-lg shadow-lg ring-1 ring-border" />
                      <PinOverlay pins={pinsFor(oldM.id)} openPin={openPin} onPinClick={togglePin} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
          <Panel side="Previous" value={oldId} onChange={setOldId} mockups={mockups} scrollRef={leftRef} onScroll={() => sync("l")} pins={pinsFor(oldId)} openPin={openPin} onPinClick={togglePin} />
          <Panel side="Latest" value={newId} onChange={setNewId} mockups={mockups} scrollRef={rightRef} onScroll={() => sync("r")} pins={pinsFor(newId)} openPin={openPin} onPinClick={togglePin} />
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

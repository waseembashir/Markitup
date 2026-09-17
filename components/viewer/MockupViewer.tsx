"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toNormalized } from "@/lib/coords";
import { PinMarker } from "./PinMarker";
import { PinComposer } from "./PinComposer";
import { CommentThread, type Member } from "./CommentThread";
import { HTML_HEIGHT_MESSAGE, HTML_SCROLL_MESSAGE, HTML_SCROLLBY_MESSAGE, HTML_MODE_MESSAGE, HTML_POINTER_MESSAGE, injectHeightReporter, stripHeightReporter } from "@/lib/html-embed";
import type { PendingAttachment } from "./RichCommentInput";
import { CommentFilter, type Filter } from "./CommentFilter";
import { createPin, addComment, movePin } from "@/app/app/mockups/[mockupId]/actions";
import { useLivePins } from "./useLivePins";
import { timeAgo, htmlToText } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/app/AppSidebar";
import { ClientViewsMenu } from "./ClientViewsMenu";

export type ViewerComment = {
  id: string;
  body: string;
  authorName: string;
  // Who wrote it, so the UI can offer Edit on your own words and nobody else's.
  authorId: string | null;
  // Set once a comment has been changed after posting; null means never edited.
  editedAt: string | null;
  parentCommentId: string | null;
  createdAt: string;
  attachments: { url: string; type: "image" | "pdf"; name: string }[];
};
export type ViewerPin = {
  id: string;
  // Which version of the file this pin was left on. Feedback follows the file
  // across versions, so the rail shows every version's comments — but a pin is
  // a coordinate on one particular layout, so only the current version's are
  // drawn on the canvas.
  mockupId: string;
  version: number;
  isCurrentVersion: boolean;
  // Who left it — they may move it, as may the team.
  createdBy: string | null;
  x: number;
  y: number;
  // Normalized size of a dragged region extending right/down from x,y.
  // 0,0 means a plain point pin.
  w: number;
  h: number;
  number: number;
  status: "active" | "resolved";
  // The viewport this feedback was left on. Desktop and mobile layouts put the
  // same element in different places, so their pins are kept apart.
  device: "desktop" | "mobile";
  comments: ViewerComment[];
};

type Sibling = { id: string };
type Zoom = { mode: "fit-window" | "fit-width" | "percent"; pct: number };

const ZOOM_OPTIONS: { label: string; value: Zoom }[] = [
  { label: "Fit in window", value: { mode: "fit-window", pct: 0 } },
  { label: "Fit horizontally", value: { mode: "fit-width", pct: 0 } },
  ...[25, 50, 75, 100, 125, 150, 175, 200].map((p) => ({
    label: `${p}%`,
    value: { mode: "percent" as const, pct: p },
  })),
];

// A press that barely moves is a point pin (exactly the old behaviour); drag
// further and it becomes a region, the way Figma's comment tool works.
const DRAG_THRESHOLD_PX = 4;

const RAIL_DEFAULT = 280;
const RAIL_MIN = 220;
const RAIL_MAX = 620;

const SORTS = [
  { key: "pins", label: "Pin order" },
  { key: "newest", label: "Latest activity" },
  { key: "oldest", label: "Oldest first" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function latestAt(p: ViewerPin) {
  return p.comments.reduce((m, c) => (c.createdAt > m ? c.createdAt : m), "");
}

// How far an embedded HTML page must scroll to centre a pin in the canvas.
// Pin y is normalized against the page's FULL height, so it multiplies back up
// to a page offset; a region centres on its middle rather than its top edge.
// Returns null when the page hasn't reported its height yet — scrolling by a
// delta computed from zero would fling the reader to the top.
export function htmlScrollDelta(
  pin: { y: number; h: number },
  pageHeight: number,
  viewHeight: number,
  currentScrollY: number,
): number | null {
  if (!pageHeight || !viewHeight) return null;
  const centreOfPin = (pin.y + pin.h / 2) * pageHeight;
  const target = Math.max(0, Math.min(centreOfPin - viewHeight / 2, pageHeight - viewHeight));
  return Math.round(target - currentScrollY);
}

function PinListItem({ pin, onSelect }: { pin: ViewerPin; onSelect: () => void }) {
  const first = pin.comments.find((c) => !c.parentCommentId);
  const resolved = pin.status === "resolved";
  // Everything after the opening comment is a reply. A faint "3 messages" read
  // as nothing, so the people who answered are shown instead — a thread with
  // replies should be obvious at a glance against one without.
  const replies = pin.comments.filter((c) => c.id !== first?.id);
  const repliers = [...new Map(replies.map((c) => [c.authorName, c])).values()];
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-[color:var(--accent)]"
    >
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold"
        style={{
          background: resolved ? "var(--success)" : "var(--primary)",
          color: resolved ? "#fff" : "var(--primary-foreground)",
        }}
      >
        {pin.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {first ? first.authorName : "Empty pin"}
          </span>
          <span className="flex shrink-0 items-baseline gap-1.5">
            {/* Feedback from an earlier version is kept, and marked, so it is
                obvious it belongs to a design that is no longer on screen. */}
            {!pin.isCurrentVersion && (
              <span className="rounded bg-canvas px-1 py-px font-mono text-[0.625rem] font-semibold text-faint">
                V{pin.version}
              </span>
            )}
            {first && <span className="font-mono text-[0.6875rem] text-faint">{timeAgo(first.createdAt)}</span>}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
          {first ? htmlToText(first.body) : "No comment yet"}
        </span>
        {replies.length > 0 && (
          <span
            className="mt-2 inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1"
            style={{ background: "var(--color-brand-soft)" }}
          >
            <span className="flex -space-x-1.5">
              {repliers.slice(0, 3).map((c) => (
                <span key={c.id} className="rounded-full ring-2 ring-[color:var(--color-brand-soft)]">
                  <Avatar name={c.authorName} email={c.authorName} size={17} />
                </span>
              ))}
            </span>
            <span className="text-[0.6875rem] font-bold" style={{ color: "var(--color-brand-ink)" }}>
              {replies.length === 1 ? "1 reply" : `${replies.length} replies`}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-[color:var(--accent)] hover:text-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MockupViewer({
  mockupId,
  projectId,
  imageUrl,
  imageName,
  initialPins,
  siblings,
  members,
  currentUserName,
  currentUserEmail,
  currentUserId,
  initialPinId,
  devices: initialDevices,
  canManage = false,
  figmaEmbedUrl,
  htmlUrl,
  titleSlot,
  actionsSlot,
}: {
  mockupId: string;
  projectId: string;
  imageUrl: string;
  imageName: string;
  initialPins: ViewerPin[];
  siblings: Sibling[];
  members: Member[];
  currentUserName: string;
  currentUserEmail?: string;
  // Whose comments carry an Edit affordance. Null for a guest, who has no
  // account and so nothing of their own to go back and change.
  currentUserId?: string | null;
  // A thread to open on arrival, set when someone follows an earlier version's
  // comment out of the rail.
  initialPinId?: string | null;
  // The views clients are offered for this file. The team always gets both.
  devices?: ("desktop" | "mobile")[];
  // The owning team, who can move anyone's pin and change client views.
  canManage?: boolean;
  // When set, the canvas is a live Figma prototype embed (animations/video play)
  // with a transparent pin-capture overlay on top, instead of a static image.
  figmaEmbedUrl?: string | null;
  // When set, the canvas is an uploaded HTML page rendered live in a sandboxed
  // iframe. Browse mode lets the client interact; Comment mode drops pins.
  htmlUrl?: string | null;
  // Rendered into the single top bar: the left title area and the right-hand
  // actions (share, notifications, profile). Supplied by the page.
  titleSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
}) {
  // The version on screen, taken from the pins the server already tagged.
  const currentVersion = initialPins.find((p) => p.isCurrentVersion)?.version ?? 1;
  const isFigma = !!figmaEmbedUrl;
  const isHtml = !!htmlUrl;
  const [pins, setPins] = useState<ViewerPin[]>(initialPins);
  // Someone else commenting on this file updates it here, without a reload.
  useLivePins(mockupId, setPins);
  const [railOpen, setRailOpen] = useState(true);
  const toast = useToast();
  const [htmlHeight, setHtmlHeight] = useState(0);
  const [htmlScrollY, setHtmlScrollY] = useState(0);
  const [htmlMode, setHtmlMode] = useState<"browse" | "comment">("browse");
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null);
  const [htmlError, setHtmlError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const htmlFrameRef = useRef<HTMLIFrameElement>(null);
  // Latest signed URL, without making the fetch effect depend on it (it changes
  // on every revalidatePath after a comment, which would reload the iframe).
  const htmlUrlRef = useRef(htmlUrl);
  // Synced in an effect rather than assigned during render — writing a ref while
  // rendering is unsafe under concurrent rendering. Declared before the fetch
  // effect below so it has the current URL by the time that effect runs.
  useEffect(() => {
    htmlUrlRef.current = htmlUrl;
  }, [htmlUrl]);
  const [activePinId, setActivePinId] = useState<string | null>(initialPinId ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("pins");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState<Zoom>({ mode: "fit-width", pct: 0 });
  const [zoomOpen, setZoomOpen] = useState(false);
  // What clients are offered. Held in state so the team's change applies at once.
  const [clientDevices, setClientDevices] = useState<("desktop" | "mobile")[]>(initialDevices ?? ["desktop", "mobile"]);
  // The team always sees both; a client sees only what the team released.
  const availableDevices: ("desktop" | "mobile")[] = canManage ? ["desktop", "mobile"] : clientDevices;
  const [device, setDevice] = useState<"desktop" | "mobile">(
    canManage || (initialDevices ?? ["desktop"]).includes("desktop") ? "desktop" : "mobile",
  );
  const [draft, setDraft] = useState<{ x: number; y: number; w?: number; h?: number; pinId?: string; number?: number } | null>(null);
  // Live rectangle while dragging out a region, before it becomes a draft pin.
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const railWidthRef = useRef(RAIL_DEFAULT);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });
  // The rail's width is driven imperatively rather than through state. React
  // never renders a width for the <aside>, so writing it on the node can't be
  // undone by a re-render — and dragging the handle no longer re-renders the
  // whole viewer on every mousemove, which is what made resizing feel heavy.
  // Re-runs when the rail is reopened, since it remounts at the default width.
  useEffect(() => {
    if (!railOpen || !railRef.current) return;
    const saved = Number(localStorage.getItem("markitup-rail-width"));
    const w = saved >= RAIL_MIN && saved <= RAIL_MAX ? saved : RAIL_DEFAULT;
    railWidthRef.current = w;
    railRef.current.style.width = `${w}px`;
  }, [railOpen]);

  function startRailResize(e: React.MouseEvent) {
    e.preventDefault();
    const left = railRef.current?.getBoundingClientRect().left ?? 0;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(RAIL_MAX, Math.max(RAIL_MIN, ev.clientX - left));
      railWidthRef.current = w;
      if (railRef.current) railRef.current.style.width = `${w}px`;
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("markitup-rail-width", String(Math.round(railWidthRef.current)));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // track the scroll container size
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Storage serves the uploaded .html as text/plain, so an <iframe src> would
  // show source. Fetch the markup and render it via srcdoc, which is always
  // parsed as HTML and stays in the sandbox's opaque origin.
  useEffect(() => {
    if (!isHtml) return;
    const url = htmlUrlRef.current;
    if (!url) return;
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    setHtmlDoc(null);
    setHtmlError(false);
    fetch(url, { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((text) => { if (alive) setHtmlDoc(injectHeightReporter(stripHeightReporter(text))); })
      .catch(() => { if (alive) setHtmlError(true); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
    // Fetch ONCE per mockup, not per signed-URL change — a comment's
    // revalidatePath() mints a fresh URL, and re-fetching it reloads the page.
    // htmlUrl is read through htmlUrlRef for exactly that reason.
  }, [isHtml, mockupId]);

  // Read inside the pointer handler below, which must not be re-subscribed on
  // every scroll frame just to see a current value.
  const htmlScrollYRef = useRef(0);
  const htmlHeightRef = useRef(0);
  const htmlDragRef = useRef<{ x: number; y: number; ix: number; iy: number } | null>(null);
  const htmlModeRef = useRef(htmlMode);
  const htmlDesignWRef = useRef(1440);
  const htmlScaleRef = useRef(1);

  // A pointer forwarded out of the HTML page. Coordinates arrive in the page's
  // own CSS pixels — unscaled, and relative to its viewport — so they normalize
  // against the design width and the page's own scroll, with no canvas geometry
  // involved at all.
  function handleFramePointer(d: { phase?: string; x?: number; y?: number; button?: number }) {
    if (htmlModeRef.current !== "comment") return;
    const ix = typeof d.x === "number" ? d.x : 0;
    const iy = typeof d.y === "number" ? d.y : 0;
    const norm = (px: number, py: number) => ({
      x: Math.min(1, Math.max(0, px / htmlDesignWRef.current)),
      y: Math.min(1, Math.max(0, (py + htmlScrollYRef.current) / (htmlHeightRef.current || 1))),
    });

    if (d.phase === "down") {
      if (d.button !== 0) return;
      const start = norm(ix, iy);
      htmlDragRef.current = { ...start, ix, iy };
      setActivePinId(null);
      setPinError(null);
      setDraft(null);
      return;
    }

    const from = htmlDragRef.current;
    if (!from) return;
    const cur = norm(ix, iy);
    const rect = {
      x: Math.min(from.x, cur.x),
      y: Math.min(from.y, cur.y),
      w: Math.abs(cur.x - from.x),
      h: Math.abs(cur.y - from.y),
    };

    if (d.phase === "move") {
      setMarquee(rect);
      return;
    }

    if (d.phase === "up") {
      htmlDragRef.current = null;
      setMarquee(null);
      // Threshold in screen pixels, so it means the same thing at any zoom.
      const moved = Math.hypot(ix - from.ix, iy - from.iy) * htmlScaleRef.current;
      if (moved < DRAG_THRESHOLD_PX) setDraft({ x: from.x, y: from.y, w: 0, h: 0 });
      else setDraft(rect);
    }
  }

  // HTML frame reports its own page height (it's cross-origin/opaque, so we
  // can't read it directly). Size the frame to it so pins line up.
  useEffect(() => {
    if (!isHtml) return;
    function onMsg(e: MessageEvent) {
      if (e.source !== htmlFrameRef.current?.contentWindow) return;
      const d = e.data;
      if (d && d.type === HTML_HEIGHT_MESSAGE && typeof d.height === "number") {
        const h = Math.min(60000, Math.max(200, Math.ceil(d.height)));
        htmlHeightRef.current = h;
        setHtmlHeight(h);
      } else if (d && d.type === HTML_SCROLL_MESSAGE && typeof d.y === "number") {
        // The page scrolls inside the iframe (like a real browser); it reports
        // its scroll position so the pin layer can follow it.
        htmlScrollYRef.current = d.y;
        setHtmlScrollY(d.y);
      } else if (d && d.type === HTML_POINTER_MESSAGE) {
        handleFramePointer(d);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isHtml]);

  // HTML renders at a real DESKTOP width (never the canvas width) and scrolls
  // INTERNALLY like a live browser, so uploaded pages show their true desktop
  // layout and their scroll-triggered animations actually play. The pin layer
  // is translated to match the page's reported scroll so pins stay aligned.
  const HTML_DESKTOP_W = 1440;
  const HTML_MOBILE_W = 375;
  const HTML_MOBILE_H = 844;
  const htmlDesignW = device === "mobile" ? HTML_MOBILE_W : HTML_DESKTOP_W;
  // Zoom applies to HTML as well as images. A live page scrolls internally and
  // has no fixed height, so "fit in window" means fit the DEVICE FRAME: the
  // phone's 375×844 body on mobile, and (a desktop page being unbounded
  // vertically) the 1440px width on desktop. Percentages are literal — 100% is
  // the true device width — and the canvas scrolls horizontally when the scaled
  // frame is wider than it.
  const htmlScale = useMemo(() => {
    if (box.w <= 0) return 1;
    if (zoom.mode === "percent") return zoom.pct / 100;
    if (device === "mobile" && zoom.mode === "fit-window") {
      // never enlarge a phone past 1×, and keep it inside both dimensions
      return Math.min(1, (box.h - 32) / HTML_MOBILE_H, box.w / HTML_MOBILE_W);
    }
    return box.w / htmlDesignW;
  }, [box, zoom, device, htmlDesignW]);
  const htmlViewH = htmlScale > 0 ? box.h / htmlScale : box.h; // iframe design height (fills canvas height)
  const htmlVisualW = htmlDesignW * htmlScale;

  // Mirror the derived frame geometry into refs. The pointer handler reads these
  // from a listener that is deliberately subscribed once, so it cannot close
  // over a stale scale or a stale mode.
  useEffect(() => {
    htmlModeRef.current = htmlMode;
    htmlDesignWRef.current = htmlDesignW;
    htmlScaleRef.current = htmlScale;
  }, [htmlMode, htmlDesignW, htmlScale]);

  // Tell the page whether it is being read or commented on. It swallows clicks
  // and reports the pointer while commenting, and does nothing while browsing.
  useEffect(() => {
    if (!isHtml) return;
    const send = () =>
      htmlFrameRef.current?.contentWindow?.postMessage({ type: HTML_MODE_MESSAGE, mode: htmlMode }, "*");
    send();
    // The frame may still be parsing when the mode changes, and a page that
    // never hears the message would silently swallow nothing.
    const t = setTimeout(send, 300);
    return () => clearTimeout(t);
  }, [isHtml, htmlMode, htmlDoc]);
  const htmlOffsetX = Math.max(0, (box.w - htmlVisualW) / 2); // center the phone; 0 when filling width

  // displayed width of the image for the current zoom mode
  const displayW = useMemo(() => {
    if (!nat.w || !box.w) return 0;
    const pad = 48; // matches p-6 on both sides
    const availW = Math.max(0, box.w - pad);
    const availH = Math.max(0, box.h - pad);
    // Mobile preview frames the design at a phone width, and zoom scales that
    // frame — so 100% is the phone's 375px, matching the HTML view's semantics.
    if (device === "mobile") {
      const phoneW = Math.min(HTML_MOBILE_W, availW);
      return zoom.mode === "percent" ? HTML_MOBILE_W * (zoom.pct / 100) : phoneW;
    }
    if (zoom.mode === "fit-width") return availW;
    if (zoom.mode === "fit-window") {
      const scale = Math.min(availW / nat.w, availH / nat.h);
      return nat.w * scale;
    }
    return nat.w * (zoom.pct / 100);
  }, [nat, box, zoom, device]);

  const shownPct = nat.w && displayW ? Math.round((displayW / nat.w) * 100) : null;
  const zoomLabel =
    zoom.mode === "fit-window"
      ? "Fit in window"
      : zoom.mode === "fit-width"
        ? "Fit horizontally"
        : `${zoom.pct}%`;

  // Bring a pin into view (centered) when it's selected from the comment rail,
  // so the anchored popup is always visible even if the pin was scrolled off.
  function scrollToPin(p: ViewerPin) {
    // An HTML page scrolls INSIDE its sandboxed frame, so there is no scroll
    // container out here to move — ask the page to scroll itself, over the same
    // bridge the wheel handler uses. Without this branch, selecting a comment on
    // an HTML mockup did nothing at all: surfaceRef only exists on the image
    // branch, so the code below bailed on its first line.
    if (isHtml) {
      const dy = htmlScrollDelta(p, htmlHeight, htmlViewH, htmlScrollY);
      if (dy !== null) {
        htmlFrameRef.current?.contentWindow?.postMessage(
          { type: HTML_SCROLLBY_MESSAGE, dx: 0, dy },
          "*",
        );
      }
      return;
    }
    const sc = scrollRef.current;
    const surf = surfaceRef.current;
    if (!sc || !surf) return;
    const px = surf.offsetLeft + p.x * surf.offsetWidth;
    const py = surf.offsetTop + p.y * surf.offsetHeight;
    sc.scrollTo({
      left: px - sc.clientWidth / 2,
      top: py - sc.clientHeight / 2,
      behavior: "smooth",
    });
  }

  // Move first, confirm after: the pin is already where it was dropped, and
  // snaps back with an explanation only if the server refuses.
  async function handleMovePin(pin: ViewerPin, x: number, y: number) {
    const from = { x: pin.x, y: pin.y };
    setPins((ps) => ps.map((p) => (p.id === pin.id ? { ...p, x, y } : p)));
    const res = await movePin(mockupId, pin.id, x, y);
    if (res.error) {
      setPins((ps) => ps.map((p) => (p.id === pin.id ? { ...p, ...from } : p)));
      toast.error(res.error);
      return;
    }
    // The server clamps a region to the design; keep what it actually stored.
    if (res.x !== x || res.y !== y) {
      setPins((ps) => ps.map((p) => (p.id === pin.id ? { ...p, x: res.x!, y: res.y! } : p)));
    }
  }

  function selectPin(id: string) {
    const p = pins.find((x) => x.id === id);
    setDraft(null);
    setActivePinId(id);
    // Only a pin on this version has somewhere on the canvas to scroll to.
    // Selecting an earlier version's comment opens it where you are rather than
    // navigating: being thrown onto a different version pulls the design out
    // from under whoever was reading it.
    if (p?.isCurrentVersion) requestAnimationFrame(() => scrollToPin(p));
  }

  // Pin popups are centred on their pin, which puts them half outside the canvas
  // for any pin near an edge — and the canvas is `overflow-hidden`, so the
  // overhang was being clipped by the comments rail. Nudge each popup back
  // inside after layout, and flip it above its pin when there's no room below.
  // Written straight to the node (not through state) so it can't loop, and
  // re-run on every render so it stays correct as the canvas resizes.
  const clampPopup = (el: HTMLDivElement | null) => {
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const PAD = 8;
    el.style.transform = "translateX(-50%)";
    el.style.marginTop = "14px";
    const c = canvas.getBoundingClientRect();
    let r = el.getBoundingClientRect();

    let dx = 0;
    if (r.left < c.left + PAD) dx = c.left + PAD - r.left;
    else if (r.right > c.right - PAD) dx = c.right - PAD - r.right;
    if (dx) el.style.transform = `translateX(calc(-50% + ${Math.round(dx)}px))`;

    r = el.getBoundingClientRect();
    // Not enough room below the pin but more above it → flip up.
    if (r.bottom > c.bottom - PAD && r.height + PAD < r.top - c.top) {
      el.style.marginTop = `-${Math.round(r.height + 20)}px`;
    }

    // A thread with a few replies plus its composer can be taller than the gap
    // above the pin AND the gap below it, so neither placement fits. The popup
    // is overflow-hidden, so what got cut off was the bottom — the reply box —
    // with no way to scroll to it. Cap the popup to the canvas and let the
    // comment list inside do the scrolling, which keeps the composer on screen.
    el.style.maxHeight = `${Math.max(200, Math.round(c.height - PAD * 2))}px`;

    // Capped or not, it must still sit inside: pull it up if it hangs over.
    r = el.getBoundingClientRect();
    if (r.bottom > c.bottom - PAD) {
      const lift = r.bottom - (c.bottom - PAD);
      const current = parseFloat(el.style.marginTop) || 0;
      el.style.marginTop = `${Math.round(current - lift)}px`;
    }
  };

  // Each surface maps a viewport point into the same 0–1 space the pins live in.
  // The static surface is a plain rect; the HTML surface also has to undo the
  // frame's scale, its centring offset and the page's own scroll.
  type Mapper = (clientX: number, clientY: number) => { x: number; y: number };
  function surfaceMapper(rect: DOMRect): Mapper {
    return (cx, cy) => toNormalized(cx, cy, rect);
  }

  function beginDraft(e: React.PointerEvent<HTMLElement>, makeMapper: (rect: DOMRect) => Mapper) {
    if (e.button !== 0) return;
    const map = makeMapper(e.currentTarget.getBoundingClientRect());
    const start = map(e.clientX, e.clientY);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    setActivePinId(null);
    setPinError(null);
    setDraft(null);

    const rectFrom = (cx: number, cy: number) => {
      const cur = map(cx, cy);
      return {
        x: Math.min(start.x, cur.x),
        y: Math.min(start.y, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - start.y),
      };
    };
    const onMove = (ev: PointerEvent) => setMarquee(rectFrom(ev.clientX, ev.clientY));
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setMarquee(null);
      const moved = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
      if (moved < DRAG_THRESHOLD_PX) setDraft({ x: start.x, y: start.y, w: 0, h: 0 });
      else setDraft(rectFrom(ev.clientX, ev.clientY));
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  async function saveDraft(body: string, attachments: PendingAttachment[] = []) {
    if (!draft) return;
    const { x, y } = draft;
    const w = draft.w ?? 0;
    const h = draft.h ?? 0;
    const existingPinId = draft.pinId;
    const tmpPinId = existingPinId ?? `tmp-pin-${Date.now()}`;
    const tmpCommentId = `tmp-c-${Date.now()}`;
    const optimistic: ViewerComment = {
      id: tmpCommentId,
      body, // the user's own input; swapped for the server-sanitized copy on success
      authorName: currentUserName,
      authorId: currentUserId ?? null,
      editedAt: null,
      parentCommentId: null,
      createdAt: new Date().toISOString(),
      attachments: [],
    };

    // Show the pin + comment IMMEDIATELY — no waiting on the server.
    if (existingPinId) {
      setPins((ps) => ps.map((p) => (p.id === existingPinId ? { ...p, comments: [...p.comments, optimistic] } : p)));
    } else {
      setPins((ps) => [
        ...ps,
        // A pin being created is by definition on the version being viewed.
        { id: tmpPinId, mockupId, version: currentVersion, isCurrentVersion: true, createdBy: currentUserId ?? null, x, y, w, h, number: 0, status: "active", device, comments: [optimistic] },
      ]);
    }
    const closedDraft = draft;
    setDraft(null);
    setPinError(null);

    // Persist in the background; reconcile temp ids, or roll back on failure.
    let uiPinId = tmpPinId;
    try {
      let pinId = existingPinId;
      if (!pinId) {
        const res = await createPin(mockupId, x, y, device, w, h);
        if (res.error || !res.id || res.number == null) throw new Error(res.error || "Could not save your comment.");
        pinId = res.id;
        const realNumber = res.number;
        uiPinId = pinId;
        setPins((ps) => ps.map((p) => (p.id === tmpPinId ? { ...p, id: pinId!, number: realNumber } : p)));
      }
      const cRes = attachments.length
        ? await addComment(mockupId, pinId, body, undefined, attachments)
        : await addComment(mockupId, pinId, body);
      if (cRes.error) throw new Error(cRes.error);
      setPins((ps) =>
        ps.map((p) =>
          p.id === pinId
            ? { ...p, comments: p.comments.map((c) => (c.id === tmpCommentId ? { ...c, body: cRes.body ?? c.body } : c)) }
            : p,
        ),
      );
    } catch (e) {
      // Roll the optimistic pin/comment back out and let the user retry.
      const msg = e instanceof Error && e.message ? e.message : "Couldn't save your comment — please try again.";
      if (existingPinId) {
        setPins((ps) => ps.map((p) => (p.id === existingPinId ? { ...p, comments: p.comments.filter((c) => c.id !== tmpCommentId) } : p)));
      } else {
        setPins((ps) => ps.filter((p) => p.id !== uiPinId));
      }
      setDraft(closedDraft);
      setPinError(msg);
      toast.error(msg);
    }
  }

  // Switching device resets zoom to that frame's natural fit, so a phone opens
  // looking like a phone instead of inheriting the desktop's fit-width (which
  // would stretch a 375px frame across the whole canvas).
  function switchDevice(next: "desktop" | "mobile") {
    setDevice(next);
    setZoom(next === "mobile" ? { mode: "fit-window", pct: 0 } : { mode: "fit-width", pct: 0 });
  }

  function toggleFullscreen() {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  // Desktop and mobile are separate review surfaces — a pin left on the 1440px
  // layout points at nothing on a 375px one — so the rail, the counts and the
  // canvas all show only the pins belonging to the viewport being viewed.
  const devicePins = pins.filter((p) => p.device === device);
  const counts = {
    all: devicePins.length,
    active: devicePins.filter((p) => p.status === "active").length,
    resolved: devicePins.filter((p) => p.status === "resolved").length,
  };
  const q = query.trim().toLowerCase();
  const visiblePins = devicePins
    .filter((p) => (filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved"))
    .filter((p) =>
      !q
        ? true
        : String(p.number) === q ||
          p.comments.some((c) => htmlToText(c.body).toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      // Newest version first, so the feedback on what is on screen leads and
      // older versions read as history below it.
      if (a.version !== b.version) return b.version - a.version;
      if (sort === "pins") return a.number - b.number;
      if (sort === "newest") return latestAt(b).localeCompare(latestAt(a));
      return latestAt(a).localeCompare(latestAt(b));
    });

  // Only this version's pins go on the canvas. An older version's pin is a
  // coordinate on a layout that is no longer on screen; drawing it here would
  // point at whatever happens to occupy that spot now.
  const canvasPins = visiblePins.filter((p) => p.isCurrentVersion);
  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  const idx = siblings.findIndex((s) => s.id === mockupId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  // Pins + the pinned popup composer, shared by the image and live-embed surfaces.
  const pinsOverlay = (
    <>
      {canvasPins.map((p) => (
        <PinMarker
          key={p.id}
          number={p.number}
          x={p.x}
          y={p.y}
          w={p.w}
          h={p.h}
          status={p.status}
          selected={p.id === activePinId}
          onClick={() => setActivePinId(p.id)}
          // Your own pins, or anyone's if you run the workspace. A pin still
          // waiting for its real id cannot be moved yet — there is nothing on
          // the server to move.
          draggable={!p.id.startsWith("tmp-") && (canManage || (Boolean(currentUserId) && p.createdBy === currentUserId))}
          onMove={(nx, ny) => handleMovePin(p, nx, ny)}
        />
      ))}
      {/* the rectangle being dragged right now */}
      {marquee && marquee.w > 0 && marquee.h > 0 && (
        <span
          aria-hidden
          style={{
            left: `${marquee.x * 100}%`,
            top: `${marquee.y * 100}%`,
            width: `${marquee.w * 100}%`,
            height: `${marquee.h * 100}%`,
            borderColor: "var(--primary)",
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
          className="pointer-events-none absolute rounded-[3px] border-2 border-dashed"
        />
      )}
      {/* a region still being written up — outlined until it's saved */}
      {draft && (draft.w ?? 0) > 0 && (draft.h ?? 0) > 0 && (
        <span
          aria-hidden
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${(draft.w ?? 0) * 100}%`,
            height: `${(draft.h ?? 0) * 100}%`,
            borderColor: "var(--primary)",
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
          className="pointer-events-none absolute rounded-[3px] border-2 border-dashed"
        />
      )}
      {draft && (
        <PinComposer
          innerRef={clampPopup}
          xPct={(draft.x + (draft.w ?? 0)) * 100}
          yPct={(draft.y + (draft.h ?? 0)) * 100}
          projectId={projectId}
          pending={false}
          error={pinError}
          author={{ name: currentUserName, email: currentUserEmail ?? "" }}
          onCancel={() => { setDraft(null); setPinError(null); }}
          onSubmit={saveDraft}
        />
      )}
      {!draft && activePin && (
        <div
          // An earlier version's pin has no place on this canvas — its
          // coordinates belong to a layout that is no longer on screen, so
          // anchoring the thread to them would park it over unrelated content.
          // Centre it instead and say which version it came from.
          ref={activePin.isCurrentVersion ? clampPopup : undefined}
          // A flex column so the capped height above flows down to the thread:
          // the comment list absorbs it and the composer keeps its place.
          className="pointer-events-auto absolute z-50 flex w-80 flex-col overflow-hidden rounded-xl border bg-surface shadow-xl"
          style={
            activePin.isCurrentVersion
              ? {
                  left: `${(activePin.x + activePin.w) * 100}%`,
                  top: `${(activePin.y + activePin.h) * 100}%`,
                  transform: "translateX(-50%)",
                  marginTop: "14px",
                }
              : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", maxHeight: "80%" }
          }
          onClick={(e) => e.stopPropagation()}
        >
          {!activePin.isCurrentVersion && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-canvas px-3 py-2">
              <span className="text-xs font-semibold text-muted">
                Feedback on version {activePin.version}
              </span>
              <Link
                href={`/app/mockups/${activePin.mockupId}?pin=${activePin.id}`}
                className="shrink-0 text-xs font-semibold text-brand-ink hover:text-brand-hover"
              >
                Open that version
              </Link>
            </div>
          )}
          <CommentThread
            mockupId={mockupId}
            projectId={projectId}
            pin={activePin}
            members={members}
            currentUserName={currentUserName}
            currentUserId={currentUserId}
            onClose={() => setActivePinId(null)}
            onChange={(updated) => setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))}
            onDelete={() => { setPins((ps) => ps.filter((p) => p.id !== activePin.id)); setActivePinId(null); }}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-full flex-col">
      {/* single top bar: title | pagination | zoom + actions */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!railOpen && (
            <button
              type="button"
              onClick={() => setRailOpen(true)}
              title="Show comments"
              aria-label="Show comments panel"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 4v16" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </button>
          )}
          <div className="flex min-w-0 items-center gap-2">{titleSlot}</div>
          {isHtml && (
            <div className="ml-1 hidden shrink-0 overflow-hidden rounded-md border sm:flex">
              <button
                type="button"
                onClick={() => setHtmlMode("browse")}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors"
                style={htmlMode === "browse" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" /></svg>
                Browse
              </button>
              <button
                type="button"
                onClick={() => setHtmlMode("comment")}
                className="flex items-center gap-1.5 border-l px-2.5 py-1 text-xs font-semibold transition-colors"
                style={htmlMode === "comment" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
                Comment
              </button>
            </div>
          )}
        </div>

        {/* pagination (center) */}
        <div className="flex shrink-0 items-center gap-1">
          {prev ? (
            <Link href={`/app/mockups/${prev.id}`} className="btn-secondary btn-sm gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Prev
            </Link>
          ) : (
            <span className="btn-secondary btn-sm pointer-events-none gap-1 opacity-40">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Prev
            </span>
          )}
          <span className="px-1 font-mono text-xs text-muted">{idx >= 0 ? idx + 1 : 1} of {siblings.length || 1}</span>
          {next ? (
            <Link href={`/app/mockups/${next.id}`} className="btn-secondary btn-sm gap-1">
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          ) : (
            <span className="btn-secondary btn-sm pointer-events-none gap-1 opacity-40">
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          )}
        </div>

        {/* zoom + actions + page-supplied actions (right) */}
        <div className="flex flex-1 items-center justify-end gap-1">
          {/* device preview toggle */}
          {canManage && (
            <div className="mr-1 hidden md:block">
              <ClientViewsMenu mockupId={mockupId} devices={clientDevices} onChange={setClientDevices} />
            </div>
          )}
          {/* A single view has nothing to toggle between, so no toggle. */}
          {availableDevices.length > 1 && (
          <div className="mr-1 hidden overflow-hidden rounded-md border md:flex">
            <button
              onClick={() => switchDevice("desktop")}
              title="Desktop view"
              aria-label="Desktop view"
              className="grid h-7 w-7 place-items-center transition-colors"
              style={device === "desktop" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
            <button
              onClick={() => switchDevice("mobile")}
              title="Mobile view"
              aria-label="Mobile view"
              className="grid h-7 w-7 place-items-center border-l transition-colors"
              style={device === "mobile" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="7" y="3" width="10" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M11 18h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          )}
          <span className="mr-1 hidden font-mono text-xs text-faint lg:inline">{shownPct ? `${shownPct}%` : ""}</span>
          <div className="relative">
            <button onClick={() => setZoomOpen((o) => !o)} className="btn-secondary btn-sm gap-2">
              {zoomLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {zoomOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setZoomOpen(false)} />
                <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-surface-2 p-1 shadow-lg">
                  {ZOOM_OPTIONS.map((o) => {
                    const on = o.value.mode === zoom.mode && (o.value.mode !== "percent" || o.value.pct === zoom.pct);
                    return (
                      <button key={o.label} onClick={() => { setZoom(o.value); setZoomOpen(false); }} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[color:var(--accent)]" style={on ? { color: "var(--color-ink)", fontWeight: 700 } : { color: "var(--foreground)" }}>
                        {o.label}
                        {on && (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <ToolbarButton label="Fullscreen" onClick={toggleFullscreen}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          {actionsSlot && <div className="mx-1 h-5 w-px shrink-0 bg-border" />}
          {actionsSlot}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
      {/* comment rail (resizable, collapsible) */}
      {railOpen && (
      <aside
        ref={railRef}
        className="relative flex w-[280px] shrink-0 flex-col border-r bg-surface"
      >
        {(
          <>
            <div className="border-b p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Comments</h2>
                <div className="flex items-center gap-0.5">
                  {/* sort */}
                  <div className="relative">
                    <ToolbarButton label="Sort" onClick={() => { setSortOpen((o) => !o); setSearchOpen(false); }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ToolbarButton>
                    {sortOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-surface-2 p-1 shadow-lg">
                          {SORTS.map((s) => (
                            <button
                              key={s.key}
                              onClick={() => { setSort(s.key); setSortOpen(false); }}
                              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
                            >
                              {s.label}
                              {sort === s.key && (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-brand-ink" aria-hidden>
                                  <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {/* search */}
                  <ToolbarButton label="Search comments" onClick={() => { setSearchOpen((o) => !o); setSortOpen(false); }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
                      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </ToolbarButton>
                  {/* hide the comments panel */}
                  <ToolbarButton label="Hide comments" onClick={() => setRailOpen(false)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M9 4v16" stroke="currentColor" strokeWidth="1.7" />
                      <path d="m16 10-2 2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </ToolbarButton>
                </div>
              </div>
              {searchOpen && (
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search comments…"
                  className="field mb-3 h-9"
                />
              )}
              <CommentFilter value={filter} onChange={setFilter} counts={counts} />
            </div>
            <div className="flex-1 divide-y overflow-y-auto">
              {visiblePins.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-ink">
                    {counts.all === 0 ? "No comments yet" : "Nothing here"}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    {counts.all === 0
                      ? "Click anywhere on the design to drop your first pin."
                      : q
                        ? "No comments match your search."
                        : "Try a different filter."}
                  </p>
                </div>
              ) : (
                visiblePins.map((p) => <PinListItem key={p.id} pin={p} onSelect={() => selectPin(p.id)} />)
              )}
            </div>
          </>
        )}
        {/* drag handle: resize the rail from its right edge */}
        <div
          onMouseDown={startRailResize}
          className="group absolute top-0 right-0 z-20 h-full w-2 translate-x-1/2 cursor-col-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize comments panel"
        >
          <div className="mx-auto h-full w-0.5 bg-transparent transition-colors duration-150 group-hover:bg-[color:var(--ring)]" />
        </div>
      </aside>
      )}

      {/* canvas */}
      <div ref={canvasRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas">
        {isHtml ? (
          /* HTML: a real-browser view that scrolls INSIDE the iframe (so scroll
             animations play), with a pin layer translated to match its scroll. */
          <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-hidden">
            {htmlError ? (
              <div className="absolute inset-0 grid place-items-center bg-canvas text-sm text-faint">Couldn&apos;t load this HTML page.</div>
            ) : htmlDoc === null ? (
              <div className="absolute inset-0 grid place-items-center bg-canvas text-sm text-faint">Loading page…</div>
            ) : (
              <iframe
                ref={htmlFrameRef}
                srcDoc={htmlDoc}
                title={imageName}
                sandbox="allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-pointer-lock"
                referrerPolicy="no-referrer"
                className={`absolute top-0 origin-top-left border-0 bg-white ${device === "mobile" ? "rounded-[28px] shadow-2xl ring-1 ring-black/10" : ""}`}
                style={{ left: htmlOffsetX, width: htmlDesignW, height: htmlViewH, transform: `scale(${htmlScale})` }}
              />
            )}
            {/* No capture layer over the page: it swallowed the wheel, which is
                why scrolling had to be forwarded back in and never felt right.
                The page reports the pointer out instead — see lib/html-embed. */}
            {/* pin layer spans the full page and is translated to the live scroll */}
            <div
              className="pointer-events-none absolute top-0"
              style={{ left: htmlOffsetX, width: htmlVisualW, height: (htmlHeight || 0) * htmlScale, transform: `translate3d(0, ${-htmlScrollY * htmlScale}px, 0)` }}
            >
              {pinsOverlay}
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="relative h-full overflow-auto">
            <div className="flex min-h-full min-w-full items-center justify-center p-6">
              <div ref={surfaceRef} className="relative shrink-0" style={{ width: displayW || "100%" }}>
                {isFigma ? (
                  <>
                    {/* hidden probe: read the rendered frame's aspect ratio so the
                        embed box matches the design and pins line up */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt=""
                      className="hidden"
                      onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                    />
                    <div
                      className="relative w-full overflow-hidden rounded-lg bg-surface shadow-lg ring-1 ring-border"
                      style={{ aspectRatio: nat.w && nat.h ? `${nat.w} / ${nat.h}` : "16 / 10" }}
                    >
                      <iframe
                        src={figmaEmbedUrl ?? undefined}
                        title="Figma prototype"
                        allow="fullscreen"
                        className="absolute inset-0 h-full w-full border-0"
                        style={{ pointerEvents: "none" }}
                      />
                      {/* transparent capture layer: clicks drop pins; the embed
                          underneath keeps animating video/GIF */}
                      <div className="absolute inset-0 cursor-crosshair" onPointerDown={(e) => beginDraft(e, surfaceMapper)}>
                        {pinsOverlay}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {!imgLoaded && <div className="skeleton absolute inset-0 rounded-lg" />}
                    {/* Signed Supabase URLs rotate on every revalidate, so
                        next/image would re-optimize each new URL for nothing. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={imageUrl}
                      alt="mockup"
                      onLoad={(e) => { setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); setImgLoaded(true); }}
                      onPointerDown={(e) => beginDraft(e, surfaceMapper)}
                      draggable={false}
                      className="block w-full cursor-crosshair rounded-lg shadow-lg ring-1 ring-border select-none"
                      style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s var(--ease-out-quart)" }}
                    />
                    {pinsOverlay}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

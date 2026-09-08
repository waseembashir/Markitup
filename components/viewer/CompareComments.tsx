"use client";

import { useEffect, useRef, useState } from "react";
import { CommentFilter, type Filter } from "./CommentFilter";
import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { Avatar } from "@/components/app/AppSidebar";
import { htmlToText, timeAgo, formatDateTime } from "@/lib/format";

export type CompareCommentGroup = {
  key: string; // mockup id
  label: string; // "Version 3"
  pins: ViewerPin[];
};

const SORTS = [
  { key: "pins", label: "Pin order" },
  { key: "newest", label: "Latest activity" },
  { key: "oldest", label: "Oldest first" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

type FlatPin = ViewerPin & { versionLabel: string };

function latestAt(p: ViewerPin) {
  return p.comments.reduce((m, c) => (c.createdAt > m ? c.createdAt : m), "");
}

function ToolbarButton({ onClick, label, children }: { onClick?: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-[color:var(--accent)] hover:text-ink"
    >
      {children}
    </button>
  );
}

function CommentRow({ c, small = false }: { c: ViewerComment; small?: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar name={c.authorName} email={c.authorName} size={small ? 22 : 28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{c.authorName}</span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
        </div>
        <div
          className="mt-0.5 text-sm leading-relaxed break-words text-muted [&_a]:text-brand-ink [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
        {c.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {c.attachments.map((a, i) =>
              a.type === "image" ? (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="h-20 w-20 rounded-md border object-cover" />
                </a>
              ) : (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium text-ink hover:bg-[color:var(--accent)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 3h7l4 4v14H7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.6" /></svg>
                  {a.name}
                </a>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PinListItem({ pin, open, onSelect }: { pin: FlatPin; open: boolean; onSelect: () => void }) {
  const first = pin.comments.find((c) => !c.parentCommentId);
  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);
  const resolved = pin.status === "resolved";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);
  return (
    <div ref={ref} className={open ? "bg-[color:var(--accent)]" : ""}>
      <button
        onClick={onSelect}
        className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-[color:var(--accent)]"
      >
        <span
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold"
          style={{ background: resolved ? "var(--success)" : "var(--primary)", color: resolved ? "#fff" : "var(--primary-foreground)" }}
        >
          {pin.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold text-ink">{first ? first.authorName : "Empty pin"}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="rounded bg-canvas px-1 py-px font-mono text-[0.625rem] font-semibold text-faint">{pin.versionLabel}</span>
              {first && <span className="font-mono text-[0.6875rem] text-faint">{timeAgo(first.createdAt)}</span>}
            </span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-muted" dangerouslySetInnerHTML={{ __html: first ? first.body : "No comment yet" }} />
          {pin.comments.length > 1 && (
            <span className="mt-1 block font-mono text-[0.6875rem] text-faint">{pin.comments.length} messages</span>
          )}
        </span>
      </button>
      {open && (
        <div className="space-y-4 px-3 pt-1 pb-4 pl-[3.125rem]">
          {roots.map((c) => (
            <div key={c.id}>
              <CommentRow c={c} />
              {repliesOf(c.id).length > 0 && (
                <div className="mt-2 ml-3 space-y-3 border-l pl-4">
                  {repliesOf(c.id).map((r) => (
                    <CommentRow key={r.id} c={r} small />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CompareComments({
  groups,
  openPin: openPinProp,
  onOpenPin,
}: {
  groups: CompareCommentGroup[];
  openPin?: string | null;
  onOpenPin?: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("pins");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openPinState, setOpenPinState] = useState<string | null>(null);
  // Controlled when the parent passes openPin/onOpenPin (so image pins and the
  // list stay in sync); otherwise self-managed.
  const openPin = openPinProp !== undefined ? openPinProp : openPinState;
  const setOpenPin = onOpenPin ?? setOpenPinState;

  // Flatten every version's pins into one list (tagged with its version).
  const allPins: FlatPin[] = groups.flatMap((g) => g.pins.map((p) => ({ ...p, versionLabel: g.label.replace(/^Version\s+/i, "V") })));

  const counts = {
    all: allPins.length,
    active: allPins.filter((p) => p.status === "active").length,
    resolved: allPins.filter((p) => p.status === "resolved").length,
  };
  const q = query.trim().toLowerCase();
  const visible = allPins
    .filter((p) => (filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved"))
    .filter((p) =>
      !q
        ? true
        : String(p.number) === q ||
          p.comments.some((c) => htmlToText(c.body).toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (sort === "pins") return a.number - b.number;
      if (sort === "newest") return latestAt(b).localeCompare(latestAt(a));
      return latestAt(a).localeCompare(latestAt(b));
    });

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Comments</h2>
          <div className="flex items-center gap-0.5">
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
            <ToolbarButton label="Search comments" onClick={() => { setSearchOpen((o) => !o); setSortOpen(false); }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
                <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">{counts.all === 0 ? "No comments yet" : "Nothing here"}</p>
            <p className="mt-1 text-xs text-faint">
              {counts.all === 0
                ? "Comments left on either version show up here."
                : q
                  ? "No comments match your search."
                  : "Try a different filter."}
            </p>
          </div>
        ) : (
          visible.map((p) => (
            <PinListItem key={p.id} pin={p} open={openPin === p.id} onSelect={() => setOpenPin(openPin === p.id ? null : p.id)} />
          ))
        )}
      </div>
    </div>
  );
}

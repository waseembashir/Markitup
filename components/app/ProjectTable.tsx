"use client";

import { useState } from "react";
import Link from "next/link";
import { timeAgo, plural } from "@/lib/format";
import type { FeedbackRow, FileRow, ViewerFace } from "@/app/app/dashboard-data";
import { NudgeDialog } from "@/components/app/NudgeDialog";
import { Avatar } from "@/components/app/AppSidebar";

export type TableRow = FeedbackRow & {
  name: string;
  /** The project's files, newest first. Listed under the project when >1. */
  fileRows: FileRow[];
  /** Clients who opened any of them, most recent visit first. */
  viewers: ViewerFace[];
};

const DAY = 24 * 3600 * 1000;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

/** Everything the two kinds of row — project and file — have in common. */
type Standing = {
  sharedAt: string | null;
  clientViewers: number;
  lastClientView: string | null;
  lastClientComment: string | null;
};

/**
 * Where a file stands with its client, in one word:
 * waiting to be sent → sent → opened → they've replied.
 */
function status(r: Standing, faces: ViewerFace[]) {
  if (r.lastClientComment) return { label: "Replied", tone: "done" as const, at: r.lastClientComment };
  if (r.clientViewers > 0) {
    // With faces beside it, the count is already on screen.
    const label = faces.length || r.clientViewers === 1 ? "Seen" : `Seen by ${r.clientViewers}`;
    return { label, tone: "seen" as const, at: r.lastClientView };
  }
  if (r.sharedAt) return { label: "Shared", tone: "sent" as const, at: r.sharedAt };
  return { label: "Not shared", tone: "idle" as const, at: null };
}

const TONE: Record<string, { bg: string; fg: string }> = {
  done: { bg: "color-mix(in oklch, var(--color-success) 14%, transparent)", fg: "var(--color-success)" },
  seen: { bg: "var(--color-brand-soft)", fg: "var(--color-brand-ink)" },
  sent: { bg: "var(--color-muted-bg, var(--accent))", fg: "var(--color-muted)" },
  idle: { bg: "transparent", fg: "var(--color-faint)" },
};

function Pill({ label, tone }: { label: string; tone: string }) {
  const t = TONE[tone] ?? TONE.idle;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: t.bg, color: t.fg, boxShadow: tone === "idle" ? "inset 0 0 0 1px var(--color-border)" : undefined }}
    >
      {label}
    </span>
  );
}

/** The people who opened it, overlapping, with any others as a count. */
function Faces({ people, total }: { people: ViewerFace[]; total: number }) {
  if (!people.length) return null;
  const shown = people.slice(0, 3);
  const rest = Math.max(0, total - shown.length);
  return (
    <span className="flex shrink-0 items-center" title={people.map((p) => p.name || p.email).join(", ")}>
      {shown.map((p, i) => (
        <span
          key={p.email || p.name || i}
          className={i ? "-ml-1.5" : ""}
          style={{ borderRadius: 999, boxShadow: "0 0 0 2px var(--color-surface)" }}
        >
          <Avatar name={p.name || p.email} email={p.email} size={22} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="-ml-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full px-1 text-[10px] font-bold text-muted"
          style={{ background: "var(--accent)", boxShadow: "0 0 0 2px var(--color-surface)" }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/**
 * How long the client has kept us waiting: time since they last opened it — or
 * since it was shared, if they never did. It clears the moment they reply, and
 * is emphasised from the third day, which is when a nudge is usually due.
 */
function waiting(r: Standing) {
  if (r.lastClientComment) return null;
  const since = r.lastClientView ?? r.sharedAt;
  if (!since) return null;
  const days = daysSince(since);
  const what = r.lastClientView ? "since they last opened it" : "since it was shared, and they haven't opened it";
  if (days < 1) return { text: "today", late: false, why: `Opened or shared today — no reply yet.` };
  return { text: plural(days, "day"), late: days >= 3, why: `${plural(days, "day")} ${what}, with no reply.` };
}

const WAITING_HELP =
  "how long the client has been quiet — time since they last opened the file, or since it was shared if they never opened it. It clears once they reply.";

function Cells({
  row,
  faces,
  projectId,
  mockupId,
  nudgeName,
}: {
  row: Standing & { comments: number; openThreads: number; remindersSent: number };
  faces: ViewerFace[];
  projectId: string;
  mockupId?: string;
  nudgeName: string;
}) {
  const s = status(row, faces);
  const w = waiting(row);
  return (
    <>
      <td className="px-4 py-3 text-right tabular-nums">{row.comments}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className={row.openThreads > 0 ? "font-semibold text-ink" : "text-faint"}>{row.openThreads}</span>
      </td>
      <td className="px-4 py-3">
        <span className="flex items-center gap-2">
          <Faces people={faces} total={row.clientViewers} />
          <Pill label={s.label} tone={s.tone} />
        </span>
        {s.at && <div className="mt-0.5 text-xs text-faint">{timeAgo(s.at)}</div>}
      </td>
      <td className="px-4 py-3">
        {w ? (
          <span className={w.late ? "font-semibold text-ink" : "text-muted"} title={w.why}>
            {w.text}
          </span>
        ) : (
          <span
            className="text-faint"
            title={row.lastClientComment ? "They have replied — nothing to wait for." : "Not shared yet."}
          >
            —
          </span>
        )}
        {row.remindersSent > 0 && (
          <div className="mt-0.5 text-xs text-faint">{plural(row.remindersSent, "reminder")} sent</div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <NudgeDialog projectId={projectId} projectName={nudgeName} mockupId={mockupId} />
      </td>
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="transition-transform"
      style={{ transform: open ? "rotate(90deg)" : "none" }}
    >
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A project, and — when it holds more than one file — each of its files. */
function ProjectRows({ row }: { row: TableRow }) {
  const files = row.fileRows;
  const many = files.length > 1;
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b transition-colors hover:bg-[color:var(--accent)]">
        <td className="px-4 py-3">
          <span className="flex items-start gap-1.5">
            {many ? (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? `Hide the files in ${row.name}` : `Show the files in ${row.name}`}
                className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded text-faint transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
              >
                <Chevron open={open} />
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <span className="min-w-0">
              <Link href={`/app/projects/${row.projectId}`} className="font-semibold text-ink hover:text-brand-ink">
                {row.name}
              </Link>
              <span className="mt-0.5 block text-xs text-faint">
                {plural(row.files, "file")}
                {many && !open ? " · open to see each" : ""}
              </span>
            </span>
          </span>
        </td>
        <Cells row={row} faces={row.viewers} projectId={row.projectId} nudgeName={row.name} />
      </tr>

      {many &&
        open &&
        files.map((f) => (
          <tr
            key={f.mockupId}
            className="border-b text-[13px] transition-colors hover:bg-[color:var(--accent)]"
            style={{ background: "color-mix(in oklch, var(--accent) 45%, transparent)" }}
          >
            <td className="px-4 py-2.5">
              <span className="flex items-start gap-1.5">
                <span className="w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-faint">
                      <path d="M6 3v12a3 3 0 0 0 3 3h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <Link href={`/app/mockups/${f.mockupId}`} className="truncate font-medium text-ink hover:text-brand-ink">
                      {f.name}
                    </Link>
                  </span>
                  {f.createdAt && (
                    <span className="mt-0.5 block pl-[18px] text-xs text-faint">added {timeAgo(f.createdAt)}</span>
                  )}
                </span>
              </span>
            </td>
            {/* the dialog names the file itself from its preview, so this is
                the project it sits in */}
            <Cells row={f} faces={f.viewers} projectId={f.projectId} mockupId={f.mockupId} nudgeName={row.name} />
          </tr>
        ))}
    </>
  );
}

export function ProjectTable({ rows }: { rows: TableRow[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold tracking-wide text-faint uppercase">
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 text-right font-semibold">Comments</th>
            <th className="px-4 py-3 text-right font-semibold">Open</th>
            <th className="px-4 py-3 font-semibold">Client</th>
            <th className="px-4 py-3 font-semibold">
              <span className="cursor-help border-b border-dotted border-[color:var(--color-border)]" title={WAITING_HELP}>
                Waiting
              </span>
            </th>
            <th className="px-4 py-3 text-right font-semibold">Reminder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <ProjectRows key={r.projectId} row={r} />
          ))}
        </tbody>
      </table>
      <p className="border-t px-4 py-2.5 text-xs text-faint">
        <span className="font-semibold text-muted">Waiting</span> is {WAITING_HELP}
      </p>
    </div>
  );
}

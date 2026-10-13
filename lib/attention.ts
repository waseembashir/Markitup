// What on the dashboard needs someone to act, most urgent first. Shared by the
// "Needs attention" cards and the standing table so the two never disagree.

const DAY = 24 * 3600 * 1000;

/** The client-side facts a row carries — a project's, or one of its files'. */
export type Standing = {
  sharedAt: string | null;
  lastClientView: string | null;
  lastClientComment: string | null;
};

/**
 * How long the client has kept us waiting: since they last opened it, or since
 * it was shared if they never did. Nothing once they've replied.
 */
export function quietFor(r: Standing, now = Date.now()): { since: string; days: number } | null {
  if (r.lastClientComment) return null;
  const since = r.lastClientView ?? r.sharedAt;
  if (!since) return null;
  return { since, days: Math.floor((now - new Date(since).getTime()) / DAY) };
}

/** From the third quiet day a nudge is usually due. */
export const QUIET_DAYS = 3;

type File = { mockupId: string; openThreads: number; unread?: number };
export type AttentionRow = Standing & {
  projectId: string;
  name: string;
  openThreads: number;
  unread?: number;
  unreadAt?: string | null;
  fileRows: File[];
};

export type Attention =
  | { kind: "new"; projectId: string; name: string; count: number; href: string }
  | { kind: "quiet"; projectId: string; name: string; days: number }
  | { kind: "open"; projectId: string; name: string; count: number; href: string };

/** Straight to the file when exactly one fits; otherwise the project. */
function hrefFor(row: AttentionRow, fits: (f: File) => boolean) {
  const files = row.fileRows.filter(fits);
  return files.length === 1 ? `/app/mockups/${files[0].mockupId}` : `/app/projects/${row.projectId}`;
}

/**
 * Each project once, under its most pressing reason: a client said something
 * nobody has read; a client has gone quiet; comments are still open. Newest
 * news first, then the longest silence, then the most left open.
 */
export function needsAttention(rows: AttentionRow[], now = Date.now()): Attention[] {
  const fresh: (Attention & { kind: "new" })[] = [];
  const quiet: (Attention & { kind: "quiet" })[] = [];
  const open: (Attention & { kind: "open" })[] = [];
  const at = new Map<string, string>();

  for (const r of rows) {
    if (r.unread && r.unread > 0) {
      fresh.push({ kind: "new", projectId: r.projectId, name: r.name, count: r.unread, href: hrefFor(r, (f) => (f.unread ?? 0) > 0) });
      at.set(r.projectId, r.unreadAt ?? "");
      continue;
    }
    const q = quietFor(r, now);
    if (q && q.days >= QUIET_DAYS) {
      quiet.push({ kind: "quiet", projectId: r.projectId, name: r.name, days: q.days });
      continue;
    }
    if (r.openThreads > 0) {
      open.push({ kind: "open", projectId: r.projectId, name: r.name, count: r.openThreads, href: hrefFor(r, (f) => f.openThreads > 0) });
    }
  }

  fresh.sort((a, b) => (at.get(b.projectId) ?? "").localeCompare(at.get(a.projectId) ?? ""));
  quiet.sort((a, b) => b.days - a.days);
  open.sort((a, b) => b.count - a.count);
  return [...fresh, ...quiet, ...open];
}

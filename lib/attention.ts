// How long a client has kept us waiting, for the standing table's "Waiting" /
// "No reply for" column.

const DAY = 24 * 3600 * 1000;

/** The client-side facts a row carries — a project's, or one of its files'. */
export type Standing = {
  sharedAt: string | null;
  lastClientView: string | null;
  lastClientComment: string | null;
};

/**
 * Since they last opened it, or since it was shared if they never did.
 * Nothing once they've replied.
 */
export function quietFor(r: Standing, now = Date.now()): { since: string; days: number } | null {
  if (r.lastClientComment) return null;
  const since = r.lastClientView ?? r.sharedAt;
  if (!since) return null;
  return { since, days: Math.floor((now - new Date(since).getTime()) / DAY) };
}

/** From the third quiet day a nudge is usually due, so the table emphasises it. */
export const QUIET_DAYS = 3;

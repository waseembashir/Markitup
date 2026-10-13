"use client";

import Link from "next/link";
import { plural } from "@/lib/format";
import type { Attention } from "@/lib/attention";
import { NudgeDialog } from "@/components/app/NudgeDialog";

const MAX = 4;

const LOOK = {
  new: { dot: "var(--color-danger)", tint: "color-mix(in oklch, var(--color-danger) 7%, var(--color-surface))" },
  quiet: { dot: "var(--color-warning, #d97706)", tint: "var(--color-surface)" },
  open: { dot: "var(--color-brand)", tint: "var(--color-surface)" },
} as const;

function reason(a: Attention) {
  if (a.kind === "new") return `${a.count} new client ${a.count === 1 ? "comment" : "comments"}`;
  if (a.kind === "quiet") return `Client quiet for ${plural(a.days, "day")}`;
  return `${plural(a.count, "open comment")} to resolve`;
}

/**
 * The top of the dashboard: the few projects where someone should act now,
 * each with the action itself — read the new comments, remind a quiet client,
 * resolve what's open. The full picture is in "Where each project stands".
 */
export function NeedsAttention({ items }: { items: Attention[] }) {
  const shown = items.slice(0, MAX);
  const more = items.length - shown.length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Needs attention</h2>
        {more > 0 && <span className="text-xs text-muted">{more} more in “Where each project stands” below</span>}
      </div>

      {shown.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm text-muted">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-brand-ink" aria-hidden>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          All caught up — no new client comments, no client waiting on a reminder, nothing left open.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((a) => (
            <li
              key={a.projectId}
              className="flex flex-col justify-between gap-3 rounded-xl border p-4"
              style={{ background: LOOK[a.kind].tint }}
            >
              <div className="min-w-0">
                <Link href={`/app/projects/${a.projectId}`} className="block truncate text-sm font-semibold text-ink hover:text-brand-ink">
                  {a.name}
                </Link>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LOOK[a.kind].dot }} aria-hidden />
                  {reason(a)}
                </p>
              </div>
              <div>
                {a.kind === "quiet" ? (
                  <NudgeDialog projectId={a.projectId} projectName={a.name} />
                ) : (
                  <Link href={a.href} className="btn-secondary btn-sm">
                    {a.kind === "new" ? "Read them" : "Review"}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

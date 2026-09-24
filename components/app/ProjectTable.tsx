import Link from "next/link";
import { timeAgo, plural } from "@/lib/format";
import type { FeedbackRow } from "@/app/app/dashboard-data";
import { NudgeDialog } from "@/components/app/NudgeDialog";

export type TableRow = FeedbackRow & { name: string };

const DAY = 24 * 3600 * 1000;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);

/**
 * Where a project stands with its client, in one word:
 * waiting to be sent → sent → opened → they've replied.
 */
function status(r: FeedbackRow) {
  if (r.lastClientComment) return { label: "Replied", tone: "done" as const, at: r.lastClientComment };
  if (r.clientViewers > 0) {
    return {
      label: r.clientViewers > 1 ? `Seen by ${r.clientViewers}` : "Seen",
      tone: "seen" as const,
      at: r.lastClientView,
    };
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

/** How long the client has kept us waiting, and whether that is worth saying. */
function waiting(r: FeedbackRow) {
  if (r.lastClientComment) return null;
  const since = r.lastClientView ?? r.sharedAt;
  if (!since) return null;
  const days = daysSince(since);
  if (days < 1) return { text: "today", late: false };
  return { text: plural(days, "day"), late: days >= 3 };
}

export function ProjectTable({ rows }: { rows: TableRow[] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold tracking-wide text-faint uppercase">
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 text-right font-semibold">Comments</th>
            <th className="px-4 py-3 text-right font-semibold">Open</th>
            <th className="px-4 py-3 font-semibold">Client</th>
            <th className="px-4 py-3 font-semibold">Waiting</th>
            <th className="px-4 py-3 text-right font-semibold">Reminder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = status(r);
            const w = waiting(r);
            return (
              <tr key={r.projectId} className="border-b last:border-0 transition-colors hover:bg-[color:var(--accent)]">
                <td className="px-4 py-3">
                  <Link href={`/app/projects/${r.projectId}`} className="font-semibold text-ink hover:text-brand-ink">
                    {r.name}
                  </Link>
                  <div className="mt-0.5 text-xs text-faint">{plural(r.files, "file")}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.comments}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={r.openThreads > 0 ? "font-semibold text-ink" : "text-faint"}>{r.openThreads}</span>
                </td>
                <td className="px-4 py-3">
                  <Pill label={s.label} tone={s.tone} />
                  {s.at && <div className="mt-0.5 text-xs text-faint">{timeAgo(s.at)}</div>}
                </td>
                <td className="px-4 py-3">
                  {w ? (
                    <span className={w.late ? "font-semibold text-ink" : "text-muted"}>{w.text}</span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                  {r.remindersSent > 0 && (
                    <div className="mt-0.5 text-xs text-faint">
                      {plural(r.remindersSent, "reminder")} sent
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <NudgeDialog projectId={r.projectId} projectName={r.name} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

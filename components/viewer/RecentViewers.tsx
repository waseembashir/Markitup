"use client";

import { useState } from "react";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo } from "@/lib/format";

export type Viewer = { id: string; name: string; email: string; viewedAt: string };

export function RecentViewers({ viewers }: { viewers: Viewer[] }) {
  const [open, setOpen] = useState(false);
  if (viewers.length === 0) return null;
  // Two faces and a count. Six overlapping circles were the widest thing in a
  // bar that already held the version, the tabs and the share button, and the
  // sixth face told nobody anything the count does not.
  const shown = viewers.slice(0, 2);
  const extra = viewers.length - shown.length;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Viewed by ${viewers.length}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center rounded-full pl-1 transition hover:opacity-90"
      >
        <span className="flex -space-x-2">
          {shown.map((v) => (
            <span key={v.id} className="rounded-full ring-2 ring-[color:var(--color-surface)]">
              <Avatar name={v.name} email={v.email} size={26} />
            </span>
          ))}
          {extra > 0 && (
            <span
              className="grid h-[26px] w-[26px] place-items-center rounded-full text-[0.625rem] font-semibold ring-2 ring-[color:var(--color-surface)]"
              style={{ background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }}
            >
              +{extra}
            </span>
          )}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2 text-xs font-semibold text-muted">Recently viewed by</div>
            <ul className="max-h-80 divide-y overflow-y-auto">
              {viewers.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={v.name} email={v.email} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{v.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{timeAgo(v.viewedAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

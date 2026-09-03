"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getNotifications, markNotificationsRead, grantAccessRequest, type NotificationItem } from "@/app/app/notifications-actions";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/app/AppSidebar";

// Render a notification body with the load-bearing words emphasized: the actor's
// name (leading), any quoted text, and file names.
function renderBody(body: string, actorName: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const bold = (text: string, key: string) => (
    <strong key={key} className="font-semibold text-ink">{text}</strong>
  );

  let rest = body;
  let k = 0;
  if (actorName && body.toLowerCase().startsWith(actorName.toLowerCase())) {
    parts.push(bold(body.slice(0, actorName.length), `a${k++}`));
    rest = body.slice(actorName.length);
  }

  const re = /("[^"]+"|\S+\.(?:png|jpe?g|html?|pdf|gif|webp|svg))/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last) parts.push(<span key={`t${k}`}>{rest.slice(last, m.index)}</span>);
    parts.push(bold(m[0], `b${k}`));
    last = m.index + m[0].length;
    k++;
  }
  if (last < rest.length) parts.push(<span key={`t${k}`}>{rest.slice(last)}</span>);
  return parts;
}

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Granting is optimistic in the panel: the row flips to "Access granted"
  // immediately, and the next poll confirms it from the server.
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function allow(id: string) {
    setBusyId(id);
    setError(null);
    setErrorId(null);
    const res = await grantAccessRequest(id);
    setBusyId(null);
    if (res?.error) {
      setErrorId(id);
      setError(res.error);
      return;
    }
    setGranted((s) => new Set(s).add(id));
  }

  const refresh = useCallback(async () => {
    const res = await getNotifications();
    setItems(res.items);
    setUnread(res.unreadCount);
  }, []);

  // Poll the server for notifications. `refresh` only sets state after its await,
  // i.e. from a callback rather than synchronously during the effect — which is
  // precisely the subscribe-to-an-external-system shape the rule allows, but it
  // can't see through the async function.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await markNotificationsRead();
      setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={toggle}
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-bold text-white"
            style={{ background: "var(--color-danger)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-3 text-sm font-semibold text-ink">Notifications</div>
            <div className="max-h-96 divide-y overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-faint">You&apos;re all caught up.</p>
              ) : (
                items.map((n) => {
                  // An access request is a decision, not an announcement — it
                  // gets an action here rather than linking away to the file the
                  // requester still can't open.
                  if (n.type === "access_request" && n.projectId) {
                    const done = n.granted || granted.has(n.id);
                    return (
                      <div key={n.id} className="flex items-start gap-3 px-3 py-3">
                        <Avatar name={n.actorName} email={n.actorEmail} size={30} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-muted">{renderBody(n.body, n.actorName)}</p>
                          <span className="mt-0.5 block font-mono text-[0.6875rem] text-faint">{timeAgo(n.createdAt)}</span>
                          {done ? (
                            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--success)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Access granted
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={busyId === n.id}
                              onClick={() => allow(n.id)}
                              className="btn-primary btn-sm mt-2"
                            >
                              {busyId === n.id ? "Granting…" : "Allow access"}
                            </button>
                          )}
                          {errorId === n.id && error && (
                            <p className="mt-1 text-xs font-medium" style={{ color: "var(--destructive)" }}>{error}</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  const inner = (
                    <div className="flex items-start gap-3 px-3 py-3 transition-colors hover:bg-[color:var(--accent)]">
                      <Avatar name={n.actorName} email={n.actorEmail} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-muted">{renderBody(n.body, n.actorName)}</p>
                        <span className="mt-0.5 block font-mono text-[0.6875rem] text-faint">{timeAgo(n.createdAt)}</span>
                      </div>
                    </div>
                  );
                  return n.mockupId ? (
                    <Link key={n.id} href={`/app/mockups/${n.mockupId}`} onClick={() => setOpen(false)} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id}>{inner}</div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

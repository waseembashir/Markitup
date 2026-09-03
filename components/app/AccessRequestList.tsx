"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { grantAccessRequest, type NotificationItem } from "@/app/app/notifications-actions";
import { Avatar } from "@/components/app/AppSidebar";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/format";

export function AccessRequestList({ requests }: { requests: NotificationItem[] }) {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  async function allow(n: NotificationItem) {
    setBusyId(n.id);
    const res = await grantAccessRequest(n.id);
    setBusyId(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setGranted((s) => new Set(s).add(n.id));
    toast.success(`${n.actorName} can now open it`);
    router.refresh();
  }

  return (
    <ul className="card divide-y overflow-hidden">
      {requests.map((n) => {
        const done = n.granted || granted.has(n.id);
        return (
          <li key={n.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <Avatar name={n.actorName} email={n.actorEmail} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{n.actorName}</p>
              <p className="truncate text-sm text-muted">{n.body}</p>
              <span className="mt-0.5 block font-mono text-[0.6875rem] text-faint">{timeAgo(n.createdAt)}</span>
            </div>
            {done ? (
              <span className="chip" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                Access granted
              </span>
            ) : (
              <button
                type="button"
                disabled={busyId === n.id}
                onClick={() => allow(n)}
                className="btn-primary btn-sm"
              >
                {busyId === n.id ? "Granting…" : "Allow access"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

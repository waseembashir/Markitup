"use client";

import { useState, useTransition } from "react";
import type { ViewerPin, ViewerComment } from "./MockupViewer";
import { addComment, setPinStatus, deletePin } from "@/app/app/mockups/[mockupId]/actions";
import { Avatar } from "@/components/app/AppSidebar";
import { timeAgo, formatDateTime } from "@/lib/format";
import { celebrate } from "@/lib/confetti";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RichCommentInput, type PendingAttachment } from "@/components/viewer/RichCommentInput";

export type Member = { id: string; name: string };

function CommentRow({ c, small = false }: { c: ViewerComment; small?: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar name={c.authorName} email={c.authorName} size={small ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-ink">{c.authorName}</span>
          <span className="shrink-0 font-mono text-[0.6875rem] text-faint" title={formatDateTime(c.createdAt)}>{timeAgo(c.createdAt)}</span>
        </div>
        <div
          className="mt-0.5 text-sm leading-relaxed break-words text-ink [&_a]:text-brand-ink [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: c.body }}
        />
        {c.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {c.attachments.map((a, i) =>
              a.type === "image" ? (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name} className="h-24 w-24 rounded-md border object-cover" />
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

export function CommentThread({
  mockupId,
  projectId,
  pin,
  // `members` stays in the props type (callers pass it, and it's what @mention
  // autocomplete will read) but nothing in here consumes it yet.
  currentUserName,
  onChange,
  onClose,
  onDelete,
}: {
  mockupId: string;
  projectId: string;
  pin: ViewerPin;
  members: Member[];
  currentUserName: string;
  onChange: (p: ViewerPin) => void;
  onClose?: () => void;
  onDelete?: () => void;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, startDelete] = useTransition();
  const toast = useToast();

  function doDelete() {
    startDelete(async () => {
      const res = await deletePin(mockupId, pin.id);
      setConfirmDel(false);
      if (res?.error) { toast.error(res.error); return; }
      toast.success("Comment deleted");
      onDelete?.();
    });
  }

  const roots = pin.comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => pin.comments.filter((c) => c.parentCommentId === id);
  const resolved = pin.status === "resolved";

  async function post(html: string, attachments: PendingAttachment[] = []) {
    const text = html.trim();
    if (!text && attachments.length === 0) return;
    const res = attachments.length
      ? await addComment(mockupId, pin.id, text, replyTo ?? undefined, attachments)
      : await addComment(mockupId, pin.id, text, replyTo ?? undefined);
    if (res.error) return;
    const optimistic: ViewerComment = {
      id: `tmp-${pin.comments.length}`,
      // Render only the server-sanitized HTML, never the raw editor input.
      body: res.body ?? "",
      authorName: currentUserName,
      parentCommentId: replyTo,
      createdAt: new Date().toISOString(),
      attachments: [],
    };
    onChange({ ...pin, comments: [...pin.comments, optimistic] });
    setReplyTo(null);
  }

  async function toggleStatus(e?: React.MouseEvent) {
    // capture the button position before awaiting (the event is stale after)
    const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
    const next = resolved ? "active" : "resolved";
    const res = await setPinStatus(mockupId, pin.id, next);
    if (res?.error) return;
    onChange({ ...pin, status: next });
    if (next === "resolved") {
      celebrate(rect ? rect.left + rect.width / 2 : undefined, rect ? rect.top : undefined);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-full font-mono text-xs font-bold"
          style={{ background: resolved ? "var(--success)" : "var(--primary)", color: resolved ? "#fff" : "var(--primary-foreground)" }}
        >
          {pin.number}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleStatus}
            title={resolved ? "Reopen" : "Mark resolved"}
            aria-label={resolved ? "Reopen" : "Mark resolved"}
            className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-[color:var(--accent)]"
            style={{ color: resolved ? "var(--success)" : "var(--muted-foreground)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill={resolved ? "var(--success)" : "transparent"} />
              <path d="m8.4 12 2.4 2.4L15.6 9" stroke={resolved ? "#fff" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setConfirmDel(true)}
            title="Delete comment"
            aria-label="Delete comment"
            className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete this comment?"
        message={<>This removes pin #{pin.number} and {pin.comments.length === 1 ? "its comment" : `all ${pin.comments.length} comments`}. This action cannot be undone.</>}
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        pending={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(false)}
      />

      <div className="max-h-[45vh] space-y-5 overflow-y-auto px-4 py-3">
        {roots.length === 0 && <p className="pt-2 text-sm text-faint">No comments yet. Start the thread below.</p>}
        {roots.map((c) => (
          <div key={c.id}>
            <CommentRow c={c} />
            {/* Replies get a coloured rail so an answered thread reads as
                answered — a hairline border was indistinguishable from none. */}
            <div
              className={`mt-2 ml-4 space-y-3 pl-4 ${repliesOf(c.id).length > 0 ? "border-l-2" : "border-l"}`}
              style={repliesOf(c.id).length > 0 ? { borderColor: "var(--color-brand)" } : undefined}
            >
              {repliesOf(c.id).map((r) => (
                <CommentRow key={r.id} c={r} small />
              ))}
              <button
                onClick={() => setReplyTo(c.id)}
                className="text-xs font-semibold text-brand-ink transition-colors hover:text-brand-hover"
              >
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="relative shrink-0 border-t p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-brand-soft px-3 py-2 text-xs font-medium text-brand-ink">
            Replying to a comment
            <button onClick={() => setReplyTo(null)} className="text-brand-ink/70 hover:text-brand-ink">Cancel</button>
          </div>
        )}

        <RichCommentInput projectId={projectId} placeholder="Add a comment…" onSubmit={(html, attachments) => post(html, attachments)} />
      </div>
    </div>
  );
}

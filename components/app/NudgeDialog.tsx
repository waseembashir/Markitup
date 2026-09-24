"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getNudgePreview, sendNudge, type NudgePreview } from "@/app/app/nudge-actions";
import { useToast } from "@/components/ui/toast";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { timeAgo } from "@/lib/format";

/**
 * "Remind" on a dashboard row: opens the exact email that will go out, with
 * the address it will go to, so nobody sends a nudge blind.
 */
export function NudgeDialog({
  projectId,
  projectName,
  mockupId,
}: {
  projectId: string;
  projectName: string;
  /** Remind about this file rather than the project's newest shared one. */
  mockupId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getNudgePreview(projectId, mockupId)
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        setEmail(p.recipientEmail);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, projectId, mockupId]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !preview) return;
    start(async () => {
      const res = await sendNudge(projectId, email, preview.recipientName, mockupId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success("Reminder sent", {
        description: res.autoOff
          ? `${res.sentTo} — automatic follow-ups are off, so this was a one-off.`
          : `${res.sentTo} — the next automatic follow-up is rescheduled from now.`,
      });
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => {
          // set here rather than in the effect: the dialog opens on the click,
          // so the loading state belongs to the click too
          setPreview(null);
          setLoading(true);
          setOpen(true);
        }}
      >
        Remind
      </button>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={`Send a reminder for ${projectName}`}>
            <div className="fade-anim absolute inset-0 bg-black/30" onClick={() => !pending && setOpen(false)} />
            <form onSubmit={send} className="pop-anim relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-surface-2 shadow-lg">
              <div className="border-b px-5 py-4">
                <h2 className="text-base font-bold text-ink">Send a reminder</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {preview?.pageName ? <>About “{preview.pageName}” in {projectName}.</> : <>About {projectName}.</>}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {loading && <p className="py-6 text-center text-sm text-muted">Loading the email…</p>}

                {!loading && preview?.blocked && <p className="py-6 text-center text-sm text-muted">{preview.blocked}</p>}

                {!loading && preview && !preview.blocked && (
                  <>
                    <label htmlFor="nudge-to" className="field-label">
                      To
                    </label>
                    <input
                      id="nudge-to"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@company.com"
                      required
                      autoFocus={!preview.recipientEmail}
                      className="field"
                    />
                    {preview.remindersSent > 0 && (
                      <p className="mt-1.5 text-xs text-muted">
                        {preview.remindersSent} already sent
                        {preview.lastSentAt ? ` · last ${timeAgo(preview.lastSentAt)}` : ""}.
                      </p>
                    )}

                    {/* the email itself, as the client will get it */}
                    <p className="mt-4 mb-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Preview</p>
                    <div className="overflow-hidden rounded-xl border bg-canvas">
                      <div className="border-b px-4 py-2.5">
                        <p className="text-sm font-semibold text-ink">{preview.subject}</p>
                        <p className="mt-0.5 text-xs text-faint">From MarkItUp · to {email || "your client"}</p>
                      </div>
                      <div className="bg-surface px-4 py-4">
                        <p className="text-sm font-semibold" style={{ color: "var(--color-brand-ink)" }}>
                          MarkItUp
                        </p>
                        <p className="mt-3 text-sm whitespace-pre-line text-ink">{preview.message}</p>
                        <span className="mt-4 inline-flex rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--color-brand)", color: "var(--primary-foreground)" }}>
                          {preview.buttonLabel}
                        </span>
                        <p className="mt-4 text-xs break-all text-faint">{preview.href}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-muted">
                      {preview.autoOff
                        ? "Automatic reminders are off, so this goes out once. Turn them on in Settings → Client reminders."
                        : "Sending now also restarts the automatic follow-up clock for this client."}
                    </p>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t px-5 py-4">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={pending || loading || !preview || !!preview.blocked || !email.trim()}>
                  {pending ? "Sending…" : "Send reminder"}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

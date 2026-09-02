"use client";

import { useState, useEffect } from "react";
import { Avatar } from "@/components/app/AppSidebar";
import { useToast } from "@/components/ui/toast";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { sendToClient } from "@/app/app/reminder-actions";
import {
  getShareInfo,
  setShareVisibility,
  inviteToProject,
  type ShareInfo,
} from "@/app/app/mockups/[mockupId]/share-actions";

export function ShareDialog({
  mockupId,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: {
  mockupId: string;
  // Hide the built-in "Share" button (when another control opens the dialog).
  hideTrigger?: boolean;
  // Optional controlled open state (e.g. driven by a card menu).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = openProp !== undefined;
  const [openInternal, setOpenInternal] = useState(false);
  const open = controlled ? openProp! : openInternal;
  const setOpen = (v: boolean) => {
    if (!controlled) setOpenInternal(v);
    onOpenChange?.(v);
  };
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const [clientEmail, setClientEmail] = useState("");
  const [sendingClient, setSendingClient] = useState(false);

  async function sendClient(e: React.FormEvent) {
    e.preventDefault();
    const value = clientEmail.trim();
    if (!value) return;
    setSendingClient(true);
    const res = await sendToClient(mockupId, value);
    setSendingClient(false);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    setClientEmail("");
    toast.success("Sent to client", {
      description: res.scheduled ? "Reminders will follow up automatically." : "Turn on reminders in Settings to auto-follow-up.",
    });
  }

  async function load() {
    setLoading(true);
    const res = await getShareInfo(mockupId);
    setLoading(false);
    if ("error" in res) setError(res.error);
    else setInfo(res);
  }

  // Clear the previous result as the dialog opens, during render, so a reopened
  // dialog never shows the last share's link or error while the fetch is in
  // flight. The fetch itself stays in an effect below.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setInfo(null);
    }
  }

  // Load share info whenever the dialog opens (controlled or uncontrolled).
  useEffect(() => {
    if (!open) return;
    // load() only sets state after its await, which the rule can't see through.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // load closes over stable setters only; re-running on `open` is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function addEmail(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    const res = await inviteToProject(mockupId, value);
    setBusy(false);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    setEmail("");
    await load();
  }

  async function toggleVisibility(next: boolean) {
    if (!info) return;
    const visibility = next ? "public" : "restricted";
    setInfo({ ...info, visibility });
    const res = await setShareVisibility(mockupId, visibility);
    if (res?.error) {
      setInfo({ ...info, visibility: info.visibility });
      setError(res.error);
    }
  }

  function copyLink() {
    if (!info) return;
    const url = `${window.location.origin}/s/${info.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <>
      {!hideTrigger && (
        <button onClick={() => setOpen(true)} className="btn-primary btn-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M12 15V4m0 0-4 4m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Share
        </button>
      )}

      {open && (
        <ModalPortal>
        <div className="fixed inset-0 z-[100] grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-xl border bg-surface-2 shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold text-ink">Share this file</h2>
              <button
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-faint transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Send to client — emails a view-and-comment link + starts reminders */}
              <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Send to a client</p>
              <form onSubmit={sendClient} className="flex gap-2">
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  type="email"
                  placeholder="client@email.com"
                  className="field flex-1"
                />
                <button type="submit" disabled={sendingClient || !clientEmail.trim()} className="btn-primary">
                  {sendingClient ? "Sending…" : "Send"}
                </button>
              </form>
              <p className="mt-2 text-xs text-faint">
                Emails a view-and-comment link (no account needed). If reminders are on, we&apos;ll auto-follow-up until they respond.
              </p>

              <p className="mt-5 mb-2 text-xs font-semibold tracking-wider text-faint uppercase">Invite a teammate</p>
              <form onSubmit={addEmail} className="flex gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="teammate@email.com"
                  className="field flex-1"
                />
                <button type="submit" disabled={busy || !email.trim()} className="btn-secondary">
                  {busy ? "Inviting…" : "Invite"}
                </button>
              </form>
              {error && (
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--destructive)" }}>{error}</p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                  Invited{info ? ` (${info.invited.length})` : ""}
                </p>
                {loading && <p className="text-sm text-faint">Loading…</p>}
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {info?.invited.map((m, i) => (
                    <li key={m.id ?? `inv-${i}`} className="flex items-center gap-3 rounded-md px-1 py-2">
                      <Avatar name={m.name} email={m.email} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                        {m.name !== m.email && <span className="block truncate text-xs text-faint">{m.email}</span>}
                      </span>
                      <span className="chip capitalize" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>
                        {m.pending ? "pending" : m.role}
                      </span>
                    </li>
                  ))}
                  {info && info.invited.length === 0 && (
                    <li className="px-1 py-2 text-sm text-faint">No one invited yet.</li>
                  )}
                </ul>
                {info && (
                  <p className="mt-3 text-xs text-muted">
                    All <span className="font-semibold text-ink">{info.workspaceName}</span> team members have full access.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={info?.visibility === "public"}
                  onChange={(e) => toggleVisibility(e.target.checked)}
                  disabled={!info}
                  className="h-4 w-4 accent-[color:var(--primary)]"
                />
                Anyone with the link can view
              </label>
              <button onClick={copyLink} disabled={!info} className="btn-secondary btn-sm">
                {copied ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 12a3 3 0 0 1 3-3h5a3 3 0 1 1 0 6h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M15 12a3 3 0 0 1-3 3H7a3 3 0 1 1 0-6h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteTeamMember } from "@/app/app/team-actions";
import { useToast } from "@/components/ui/toast";
import { ModalPortal } from "@/components/ui/ModalPortal";

type Role = "admin" | "member";

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Full access — manage projects, the team and settings." },
  { value: "member", label: "Manager", desc: "Manage projects and files, share with clients." },
];

export function TeamInviteDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function reset() {
    setEmail("");
    setRole("member");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    start(async () => {
      const res = await inviteTeamMember(email, role);
      if (res?.error) { toast.error(res.error); return; }
      setOpen(false);
      reset();
      const roleLabel = role === "admin" ? "Admin" : "Manager";
      if ("roleChanged" in res && res.roleChanged) {
        toast.success("Role changed", { description: res.message });
        router.refresh();
        return;
      }
      toast.success(
        res.invited ? "Invitation sent" : "Teammate added",
        { description: res.invited ? `${email.trim()} will get an email to join as ${roleLabel}.` : `Added as ${roleLabel}.` },
      );
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        Invite
      </button>

      {open && (
        <ModalPortal>
          <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Invite a teammate">
            <div className="fade-anim absolute inset-0 bg-black/30" onClick={() => !pending && setOpen(false)} />
            <form onSubmit={submit} className="pop-anim relative z-10 w-full max-w-md rounded-2xl border bg-surface-2 p-5 shadow-lg">
              <h2 className="text-base font-bold text-ink">Invite a teammate</h2>
              <p className="mt-1 text-xs text-muted">They&apos;ll get access to this workspace. Guests are invited separately, from a project&apos;s Share menu.</p>

              <label className="field-label mt-4">Email</label>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@agency.com"
                className="field"
              />

              <label className="field-label mt-4">Role</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLE_OPTIONS.map((o) => {
                  const active = role === o.value;
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => setRole(o.value)}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={active ? { borderColor: "var(--color-brand-ring)", background: "var(--color-brand-soft)" } : undefined}
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid h-4 w-4 place-items-center rounded-full border" style={active ? { borderColor: "var(--color-brand)", background: "var(--color-brand)" } : undefined}>
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm font-semibold text-ink">{o.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{o.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary btn-sm">Cancel</button>
                <button type="submit" disabled={pending || !email.trim()} className="btn-primary btn-sm">{pending ? "Sending…" : "Send invite"}</button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

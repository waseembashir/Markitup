"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

// The whole of "signing in" for a public link: type a name, start commenting.
// Behind it is a real but anonymous Supabase session, so pins, comments and RLS
// work exactly as they do for an invited reviewer — no parallel guest path.
export function GuestGate({ token, fileName }: { token: string; fileName: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);

    const supabase = createBrowserSupabase();
    // The name rides along in user metadata, which handle_new_user() copies
    // onto the profile — so comments are attributed without a second write.
    const { error: authError } = await supabase.auth.signInAnonymously({
      options: { data: { name: clean } },
    });
    if (authError) {
      setBusy(false);
      // "Anonymous sign-ins are disabled" is a Supabase project setting, not
      // anything the visitor can act on — so tell them who can, and leave the
      // real error in the console for whoever owns the app.
      const disabled = /anonymous/i.test(authError.message) && /disabled|not enabled/i.test(authError.message);
      if (disabled) console.error("[guest] anonymous sign-ins are disabled for this Supabase project", authError);
      setError(
        disabled
          ? "Commenting without an account isn't available right now. Ask whoever sent you this link, or sign in instead."
          : authError.message,
      );
      return;
    }

    // A public link grants reviewer access to whoever opens it.
    const { data: mockupId, error: joinError } = await supabase.rpc("join_project_via_share", {
      p_token: token,
    });
    if (joinError || !mockupId) {
      setBusy(false);
      setError("That link is no longer valid.");
      return;
    }
    router.replace(`/app/mockups/${mockupId}`);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 py-16">
      <div className="rise-in card w-full max-w-md p-8">
        <div className="text-center">
          <span
            className="mx-auto grid h-12 w-12 place-items-center rounded-full"
            style={{ background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 5h16v10H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="mt-4 text-lg font-bold text-ink">You&apos;ve been asked for feedback</h1>
          <p className="mt-1 text-sm text-muted">
            on <span className="font-semibold text-ink">{fileName}</span>
          </p>
        </div>

        <form onSubmit={enter} className="mt-6 flex flex-col gap-3">
          <label htmlFor="guest-name" className="field-label">
            What should we call you?
          </label>
          <input
            id="guest-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            className="field"
          />
          <button type="submit" disabled={busy || !name.trim()} className="btn-primary w-full">
            {busy ? "Opening…" : "Start reviewing"}
          </button>
          {error && (
            <p className="text-sm font-medium" style={{ color: "var(--destructive)" }} role="alert">
              {error}
            </p>
          )}
          <p className="text-center text-xs text-faint">
            No account needed. Your name is shown next to your comments.
          </p>
        </form>
      </div>
    </div>
  );
}

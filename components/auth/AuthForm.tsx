"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "@/lib/confetti";

type AuthState = { error?: string; ok?: boolean; redirect?: string };

export function AuthForm({
  action,
  next,
  submitLabel,
  successLabel = "Welcome back",
  celebrate: withConfetti = false,
  children,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  submitLabel: string;
  successLabel?: string;
  // Fire confetti on success — reserved for first-time signup, not every login.
  celebrate?: boolean;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  // Derived, not stored: the form is "done" exactly when the action came back
  // with a redirect. No effect and no extra render needed to know that.
  const done = !!(state?.ok && state.redirect);

  useEffect(() => {
    if (!state?.ok || !state.redirect) return;
    if (withConfetti) {
      // A generous welcome burst — a few bloom points feel more celebratory.
      const w = window.innerWidth;
      const h = window.innerHeight;
      celebrate(w * 0.5, h * 0.4, 160);
      const t1 = setTimeout(() => celebrate(w * 0.22, h * 0.5, 90), 160);
      const t2 = setTimeout(() => celebrate(w * 0.78, h * 0.5, 90), 300);
      router.prefetch?.(state.redirect);
      const nav = setTimeout(() => router.push(state.redirect!), 1300);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(nav); };
    }
    router.prefetch?.(state.redirect);
    const nav = setTimeout(() => router.push(state.redirect!), 1000);
    return () => clearTimeout(nav);
  }, [state, router, withConfetti]);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4" aria-hidden={done}>
        {next && <input type="hidden" name="next" value={next} />}
        {children}
        {state?.error && (
          <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending || done} className="btn-primary mt-1 w-full">
          {pending ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
              Please wait…
            </>
          ) : (
            submitLabel
          )}
        </button>
      </form>

      {done && <SuccessOverlay label={successLabel} />}
    </>
  );
}

function SuccessOverlay({ label }: { label: string }) {
  return (
    <div
      className="fade-anim fixed inset-0 z-[400] grid place-items-center backdrop-blur-sm"
      style={{ background: "color-mix(in oklch, var(--color-canvas) 86%, transparent)" }}
    >
      <div className="pop-anim flex flex-col items-center gap-4 text-center">
        <span className="grid h-24 w-24 place-items-center rounded-full" style={{ background: "var(--color-success-soft)" }}>
          <svg width="72" height="72" viewBox="0 0 56 56" fill="none" aria-hidden>
            <circle className="check-ring" cx="28" cy="28" r="26" stroke="var(--color-success)" strokeWidth="3" />
            <path className="check-tick" d="M17 29l7 7 15-16" stroke="var(--color-success)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="fade-anim" style={{ animationDelay: "0.35s" }}>
          <p className="text-xl font-bold text-ink">{label}</p>
          <p className="mt-1 text-sm text-muted">Taking you to your dashboard…</p>
        </div>
      </div>
    </div>
  );
}

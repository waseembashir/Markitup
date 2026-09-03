"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

type AuthState = { error?: string; ok?: boolean; redirect?: string };

export function AuthForm({
  action,
  next,
  submitLabel,
  children,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  const done = !!(state?.ok && state.redirect);

  // Go straight through on success. There used to be a full-screen tick and a
  // one-second pause here, which made signing in feel slower than it was — the
  // dashboard was ready the whole time, the delay was purely so the animation
  // could be seen. `replace` rather than `push` so Back doesn't land the user
  // on a login form they've already completed.
  useEffect(() => {
    if (!state?.ok || !state.redirect) return;
    router.replace(state.redirect);
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {children}
      {state?.error && (
        <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">
          {state.error}
        </p>
      )}
      {/* Stays in its pending look through the redirect, so the button never
          flicks back to "Log in" while the next page is being fetched. */}
      <button type="submit" disabled={pending || done} className="btn-primary mt-1 w-full">
        {pending || done ? (
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
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestAccess } from "@/app/app/access-actions";
import { signOut } from "@/app/auth/actions";

// Shown when a signed-in visitor opens a file they cannot see — typically after
// following a restricted share link, or after signing in with a different email
// than the one they were invited under. Replaces a bare 404, which gave them no
// idea what had happened or what to do next.
export function LockedFile({
  mockupId,
  fileName,
  projectName,
  userEmail,
}: {
  mockupId: string;
  fileName: string;
  projectName: string;
  userEmail: string;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function ask() {
    setError(null);
    start(async () => {
      const r = await requestAccess(mockupId);
      if (r.ok) setSent(true);
      else setError(r.error);
    });
  }

  return (
    <div className="grid h-full place-items-center px-6 py-16">
      <div className="rise-in card w-full max-w-md p-8 text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full"
          style={{ background: "var(--color-brand-soft)", color: "var(--color-brand-ink)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>

        <h1 className="mt-4 text-lg font-bold text-ink">You don&apos;t have access to this file</h1>
        <p className="mt-1 text-sm text-muted">
          <span className="font-semibold text-ink">{fileName}</span> in {projectName}
        </p>

        {sent ? (
          <div className="mt-6">
            <p className="text-sm font-semibold text-ink">Request sent</p>
            <p className="mt-1 text-sm text-muted">
              We let the team know. You&apos;ll get an email once someone adds you.
            </p>
          </div>
        ) : (
          <>
            <button onClick={ask} disabled={pending} className="btn-primary mt-6 w-full">
              {pending ? "Sending…" : "Request access"}
            </button>
            {error && (
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--destructive)" }}>
                {error}
              </p>
            )}
          </>
        )}

        <div className="mt-6 border-t pt-4 text-xs text-faint">
          Signed in as <span className="font-medium text-muted">{userEmail}</span>
          {" · "}
          <form action={signOut} className="inline">
            <button type="submit" className="font-semibold text-brand-ink hover:underline">
              Switch account
            </button>
          </form>
        </div>

        <Link href="/app" className="mt-4 inline-block text-sm font-medium text-muted hover:text-ink">
          ← Back to your workspace
        </Link>
      </div>
    </div>
  );
}

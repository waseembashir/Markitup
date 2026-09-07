"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

// One button for both signing in and signing up: Google creates the account on
// first use and hands back a verified email, so there is nothing to confirm
// afterwards. `next` survives the round trip through /auth/callback, which keeps
// a shared link working when the visitor has to authenticate on the way in.
export function GoogleButton({ next, label }: { next?: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const callback = new URL("/auth/callback", window.location.origin);
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      callback.searchParams.set("next", next);
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        // Always show the account chooser. Without this, anyone signed into a
        // single Google account is silently reused, which makes switching
        // accounts on a shared machine impossible.
        queryParams: { prompt: "select_account" },
      },
    });

    // On success the browser is already navigating to Google; only a failure
    // returns here.
    if (authError) {
      setBusy(false);
      const off = /provider is not enabled|unsupported provider/i.test(authError.message);
      if (off) console.error("[auth] the Google provider is not enabled for this Supabase project", authError);
      setError(off ? "Google sign-in isn't available right now. Use your email and password below." : authError.message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={go} disabled={busy} className="btn-secondary w-full justify-center gap-3">
        <GoogleMark />
        {busy ? "Opening Google…" : label}
      </button>

      {error && (
        <p className="text-sm font-medium" style={{ color: "var(--destructive)" }} role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-faint">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

// Google's mark has to keep its own colours — it is the one piece of the page
// that must not be themed.
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.4v5.7C8 41.1 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.7 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.4C2.9 17.1 2 20.4 2 24s.9 6.9 2.4 9.8l7.3-5.7Z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8 6.9 4.4 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.3-9.1Z" />
    </svg>
  );
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Where an OAuth provider returns to, and where the password-reset link lands.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Only honor same-app relative paths as the post-exchange destination.
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  const back = (reason: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    if (dest !== "/app") url.searchParams.set("next", dest);
    return NextResponse.redirect(url);
  };

  // The provider itself refused — usually the person closed the Google window
  // or declined. Say so, rather than bouncing them to /app and back to a blank
  // login form with no explanation.
  const providerError = searchParams.get("error");
  if (providerError) {
    return back(providerError === "access_denied" ? "cancelled" : "provider");
  }

  const code = searchParams.get("code");
  if (!code) return back("missing_code");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] code exchange failed", error);
    return back("exchange");
  }

  return NextResponse.redirect(`${origin}${dest}`);
}

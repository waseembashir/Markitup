import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isGuest = user?.is_anonymous === true;
  const redirectTo = (to: string) => {
    const redirect = NextResponse.redirect(new URL(to, request.url));
    // getUser() may have refreshed the session; losing those cookies here
    // would sign the user out on their very next request.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  // Signed-in visitors skip the marketing page and land in the app. Doing it
  // here, not in app/page.tsx, keeps the landing page static: it never reads
  // the session, so it can be prerendered and served from the CDN.
  //
  // Not a guest, though: a guest has no workspace, so "the app" for them is an
  // empty dashboard with no sidebar — which is exactly what a teammate saw
  // after typing the address into a browser that still held the guest session
  // from a client's link. They looked signed in, with none of their projects.
  if (user && !isGuest && path === "/") return redirectTo("/app");

  // A guest reviews the files they were shared and nothing else. Anywhere else
  // in the app, send them to log in, saying why.
  if (isGuest && (path === "/app" || path.startsWith("/app/")) && !guestMayOpen(path)) {
    return redirectTo("/login?guest=1");
  }

  return response;
}

// The parts of the app a guest from a share link can use: a file (and the
// HTML route its frame loads) and the compare screen reached from it.
export function guestMayOpen(path: string): boolean {
  return path.startsWith("/app/mockups/") || /^\/app\/projects\/[^/]+\/compare\/?$/.test(path);
}

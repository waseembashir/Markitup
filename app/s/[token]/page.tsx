import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { GuestGate } from "@/components/viewer/GuestGate";

// Entry point for a shared MarkUp link. Which door someone gets depends entirely
// on the link, never on whether they happen to have an account:
//
//   PUBLIC     → no account, ever. Give a name, get an anonymous session, comment.
//   RESTRICTED → a real account. Sign in (Google or email), then the owner either
//                already granted access or the locked screen lets you ask.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const isGuest = user?.is_anonymous === true;

  // Resolve the token before deciding anything — a public link must never show a
  // login form, so the link's visibility has to be known first.
  const { data: resolved } = await supabase.rpc("share_link_preview", { p_token: token });
  const link = Array.isArray(resolved) ? resolved[0] : resolved;
  if (!link) notFound();
  const isPublic = link.visibility === "public";

  // A restricted link needs a real account. That includes someone carrying an
  // anonymous session from an earlier public link: a guest can't be granted
  // access or even ask for it, so sending them to the locked screen would be a
  // dead end. Sign in properly instead.
  if (!isPublic && (!user || isGuest)) {
    redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
  }

  // Public link, nobody signed in: the name gate, and no account at the end of it.
  if (!user) {
    return <GuestGate token={token} fileName={link.mockup_name ?? "a design"} />;
  }

  const { data: mockupId, error } = await supabase.rpc("join_project_via_share", {
    p_token: token,
  });
  if (error || !mockupId) notFound();

  redirect(`/app/mockups/${mockupId}`);
}

import { redirect, notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { GuestGate } from "@/components/viewer/GuestGate";

// Entry point for a shared MarkUp link.
//
// A PUBLIC link needs no account: the visitor gives a name, gets an anonymous
// session and is joined to the project as a reviewer. A RESTRICTED link still
// requires a real login — it grants nothing on its own, so a non-member lands on
// the locked screen and can ask for access.
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    // Resolve the token before asking anyone to sign in — a public link should
    // never show a login form at all.
    const { data: resolved } = await supabase.rpc("share_link_preview", { p_token: token });
    const link = Array.isArray(resolved) ? resolved[0] : resolved;
    if (!link) notFound();
    if (link.visibility !== "public") {
      redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
    }
    return <GuestGate token={token} fileName={link.mockup_name ?? "a design"} />;
  }

  const { data: mockupId, error } = await supabase.rpc("join_project_via_share", {
    p_token: token,
  });
  if (error || !mockupId) notFound();

  redirect(`/app/mockups/${mockupId}`);
}

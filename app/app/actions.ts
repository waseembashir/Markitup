"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { invitation } from "@/lib/email/templates";

// Read-then-insert here created a workspace per concurrent caller: the layout
// and the page both call this, they render in the same pass, and neither saw a
// membership before the other had inserted one. ensure_workspace() does the
// whole get-or-create in one statement behind an advisory lock on the user, so
// concurrent callers agree on a single workspace. It also returns nothing for a
// guest on a public link, who is a reviewer passing through, not an account
// holder — minting them a workspace would spawn one per visitor.
export async function getCurrentWorkspace() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("ensure_workspace");
  if (error || !data?.length) return null;
  const ws = data[0] as { id: string; name: string };
  return { id: ws.id, name: ws.name };
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name")).trim();
  if (!name) return { error: "Project name is required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("projects")
    .insert({ name, workspace_id: ws.id, created_by: userData.user!.id });
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/projects");
  return {};
}

export async function getWorkspaceMembers() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return [];
  const { data } = await supabase
    .from("workspace_members")
    .select("role, profiles(id, name, email)")
    .eq("workspace_id", ws.id);
  return (data ?? []).map((m) => {
    const p = m.profiles as unknown as { id: string; name: string; email: string };
    return { id: p.id, name: p.name, email: p.email, role: m.role as string };
  });
}

export async function addMemberByEmail(formData: FormData) {
  const email = String(formData.get("email")).trim().toLowerCase();
  if (!email) return { error: "Email required" };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();

  const { data: profileId } = await supabase.rpc("find_profile_id_by_email", {
    p_email: email,
  });

  const inviterName = (userData.user?.user_metadata?.name as string) || "A teammate";

  if (profileId) {
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: profileId, role: "member" });
    if (error) return { error: error.message };
    try {
      const tpl = invitation({ inviterName, workspaceName: ws.name, isNewUser: false });
      await sendEmail({ to: email, ...tpl });
      await supabase.rpc("create_notification", {
        p_user_id: profileId,
        p_actor_id: userData.user!.id,
        p_type: "invite",
        p_mockup_id: null,
        p_project_id: null,
        p_body: `${inviterName} added you to ${ws.name}`,
      });
    } catch (e) {
      console.error("[invite] email failed", e);
    }
    revalidatePath("/app/members");
    return { invited: false };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: ws.id, email, invited_by: userData.user!.id });
  if (error) return { error: error.message };
  try {
    const tpl = invitation({ inviterName, workspaceName: ws.name, isNewUser: true });
    await sendEmail({ to: email, ...tpl });
  } catch (e) {
    console.error("[invite] email failed", e);
  }
  revalidatePath("/app/members");
  return { invited: true };
}

export async function updateProfileName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name cannot be empty" };
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", userData.user.id);
  if (error) return { error: error.message };

  // Mirror into auth metadata so headers/menus that read user_metadata stay in sync.
  await supabase.auth.updateUser({ data: { name } });

  revalidatePath("/app");
  return {};
}

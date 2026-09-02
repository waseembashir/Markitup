"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { renderWorkspaceEmail } from "@/lib/email/workspace-templates";
import { getCurrentWorkspace } from "@/app/app/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

// Workspace roles map onto the three team tiers shown in the UI:
//   owner / admin  → "Admin"     manage everything, incl. settings & the team
//   member         → "Manager"   manage projects/files, share & invite clients
//   (external)     → "Guest"     view/comment via a share link, no account
export type WorkspaceRole = "owner" | "admin" | "member";
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  isYou: boolean;
  pending: boolean;
};
export type TeamGuest = { name: string; email: string; pending: boolean };
export type TeamData = {
  admins: TeamMember[];
  managers: TeamMember[];
  guests: TeamGuest[];
  canManage: boolean;
};

export async function getTeamData(): Promise<TeamData> {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  const { data: userData } = await supabase.auth.getUser();
  const meId = userData.user?.id ?? "";
  if (!ws) return { admins: [], managers: [], guests: [], canManage: false };

  // 1. Actual workspace members
  const { data: mem } = await supabase
    .from("workspace_members")
    .select("role, profiles(id, name, email)")
    .eq("workspace_id", ws.id);
  const members: TeamMember[] = (mem ?? []).map((m) => {
    const p = m.profiles as unknown as { id: string; name: string; email: string };
    return { id: p.id, name: p.name || p.email, email: p.email, role: m.role as WorkspaceRole, isYou: p.id === meId, pending: false };
  });
  const memberEmails = new Set(members.map((m) => m.email?.toLowerCase()));
  const admins = members.filter((m) => m.role === "owner" || m.role === "admin");
  const managers = members.filter((m) => m.role === "member");
  const canManage = members.some((m) => m.isYou && (m.role === "owner" || m.role === "admin"));

  // 2. Guests = external people with project-level (reviewer) access, not workspace members
  const { data: projs } = await supabase.from("projects").select("id").eq("workspace_id", ws.id);
  const projectIds = (projs ?? []).map((p) => p.id as string);
  const guestMap = new Map<string, TeamGuest>();
  if (projectIds.length) {
    const { data: pm } = await supabase
      .from("project_members")
      .select("role, profiles(id, name, email)")
      .in("project_id", projectIds)
      .eq("role", "reviewer");
    for (const r of pm ?? []) {
      const p = r.profiles as unknown as { name: string; email: string } | null;
      const key = p?.email?.toLowerCase();
      if (!key || memberEmails.has(key)) continue;
      guestMap.set(key, { name: p!.name || p!.email, email: p!.email, pending: false });
    }
  }

  // 3. Pending invitations: project-scoped → pending guests; workspace-scoped → pending team members
  const { data: inv } = await supabase
    .from("invitations")
    .select("email, role, project_id")
    .eq("workspace_id", ws.id)
    .is("accepted_at", null);
  for (const i of inv ?? []) {
    const key = (i.email as string).toLowerCase();
    if (memberEmails.has(key)) continue;
    if (i.project_id) {
      if (!guestMap.has(key)) guestMap.set(key, { name: i.email as string, email: i.email as string, pending: true });
    } else {
      const role: WorkspaceRole = i.role === "admin" ? "admin" : "member";
      const pendingMember: TeamMember = { id: key, name: i.email as string, email: i.email as string, role, isYou: false, pending: true };
      if (role === "admin") admins.push(pendingMember);
      else managers.push(pendingMember);
    }
  }

  return { admins, managers, guests: [...guestMap.values()], canManage };
}

// Invite a teammate as an Admin or a Manager. Only admins/owners may invite.
export async function inviteTeamMember(email: string, role: "admin" | "member") {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address" };
  const safeRole: WorkspaceRole = role === "admin" ? "admin" : "member";
  const roleLabel = safeRole === "admin" ? "Admin" : "Manager";

  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) return { error: "Not signed in" };

  // Admin gate — only owner/admin can add teammates.
  const { data: myRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!myRow || !(myRow.role === "owner" || myRow.role === "admin")) {
    return { error: "Only admins can invite teammates." };
  }

  const inviterName = (me.user_metadata?.name as string) || "A teammate";
  const { data: profileId } = await supabase.rpc("find_profile_id_by_email", { p_email: clean });

  if (profileId) {
    const { error } = await supabase
      .from("workspace_members")
      .insert({ workspace_id: ws.id, user_id: profileId, role: safeRole });
    if (error) return { error: error.message };
    try {
      const content = await renderWorkspaceEmail(
        supabase,
        ws.id,
        "team_invite",
        { inviter: inviterName, role: roleLabel, workspace: ws.name },
        `${APP_URL}/login`,
      );
      await sendEmail({ to: clean, ...content });
      await supabase.rpc("create_notification", {
        p_user_id: profileId,
        p_actor_id: me.id,
        p_type: "invite",
        p_mockup_id: null,
        p_project_id: null,
        p_body: `${inviterName} added you to ${ws.name}`,
      });
    } catch (e) {
      console.error("[team invite] email failed", e);
    }
    revalidatePath("/app/settings");
    return { ok: true, invited: false };
  }

  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: ws.id, email: clean, role: safeRole, invited_by: me.id });
  if (error) return { error: error.message };
  try {
    const content = await renderWorkspaceEmail(
      supabase,
      ws.id,
      "team_invite",
      { inviter: inviterName, role: roleLabel, workspace: ws.name },
      `${APP_URL}/signup`,
    );
    await sendEmail({ to: clean, ...content });
  } catch (e) {
    console.error("[team invite] email failed", e);
  }
  revalidatePath("/app/settings");
  return { ok: true, invited: true };
}

// Take a teammate off the workspace. `id` is a profile id for a real member, or
// the email address for a still-pending invitation (getTeamData keys those rows
// by email, since no profile exists yet).
//
// The hard guards — owner is untouchable, nobody removes themselves — live in
// the RLS policy, not here, because a direct API call bypasses this action
// entirely. These checks exist to return a useful message, not to enforce.
export async function removeTeamMember(id: string) {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) return { error: "Not signed in" };

  const { data: myRow } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!myRow || !(myRow.role === "owner" || myRow.role === "admin")) {
    return { error: "Only admins can remove teammates." };
  }

  // A pending invite has no profile — revoke the invitation row instead.
  if (id.includes("@")) {
    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("workspace_id", ws.id)
      .eq("email", id.toLowerCase())
      .is("accepted_at", null);
    if (error) return { error: error.message };
    revalidatePath("/app/settings");
    return { ok: true };
  }

  if (id === me.id) return { error: "You can't remove yourself." };

  const { data: wsRow } = await supabase.from("workspaces").select("owner_id").eq("id", ws.id).maybeSingle();
  if (wsRow?.owner_id === id) return { error: "The workspace owner can't be removed." };

  const { error, count } = await supabase
    .from("workspace_members")
    .delete({ count: "exact" })
    .eq("workspace_id", ws.id)
    .eq("user_id", id);
  if (error) return { error: error.message };
  if (!count) return { error: "Couldn't remove that person — you may not have permission." };

  // Workspace access is gone, but a lingering project_members row would quietly
  // keep them in as a guest. Removing means removing.
  const { data: projs } = await supabase.from("projects").select("id").eq("workspace_id", ws.id);
  const projectIds = (projs ?? []).map((p) => p.id as string);
  if (projectIds.length) {
    await supabase.from("project_members").delete().in("project_id", projectIds).eq("user_id", id);
  }

  revalidatePath("/app/settings");
  return { ok: true };
}

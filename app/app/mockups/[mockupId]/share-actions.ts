"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { invitation } from "@/lib/email/templates";

export type Invited = {
  id: string | null;
  name: string;
  email: string;
  role: string;
  pending: boolean;
};
export type ShareInfo = {
  token: string;
  visibility: "public" | "restricted";
  invited: Invited[];
  workspaceName: string;
};

async function mockupContext(mockupId: string) {
  const supabase = await createServerSupabase();
  const { data: mk, error } = await supabase
    .from("mockups")
    // The workspace embed names its foreign key explicitly. Any table with keys
    // to both projects and workspaces looks to PostgREST like a junction between
    // them, which makes a bare `workspaces(...)` ambiguous and fails the whole
    // query — a Slack batching table did exactly that and took the Share dialog
    // down with it. Naming the key pins the path regardless of what else exists.
    .select("project_id, projects(workspace_id, name, workspaces!projects_workspace_id_fkey(name))")
    .eq("id", mockupId)
    .maybeSingle();
  // A query that FAILED is not a missing file. Reporting "File not found" for a
  // schema error sent the last one looking in entirely the wrong place.
  if (error) console.error("[share] could not load the file's context", error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proj = (mk as any)?.projects;
  return {
    supabase,
    projectId: mk?.project_id as string | undefined,
    workspaceId: proj?.workspace_id as string | undefined,
    workspaceName: (proj?.workspaces?.name as string) ?? "your team",
  };
}

export async function getShareInfo(mockupId: string): Promise<ShareInfo | { error: string }> {
  const { supabase, projectId, workspaceName } = await mockupContext(mockupId);
  if (!projectId) return { error: "File not found" };

  // Get-or-create the share link for this FILE, not for this upload of it.
  // Versions are separate mockups rows sharing a version_group, so looking the
  // link up by mockup_id alone minted a new one for every version — and every
  // link already in a client's inbox went on pointing at an older design.
  const { data: self } = await supabase
    .from("mockups")
    .select("version_group")
    .eq("id", mockupId)
    .maybeSingle();
  const group = (self as { version_group?: string } | null)?.version_group;

  let link: { token: string; visibility: string } | null = null;

  if (group) {
    const { data: existing } = await supabase
      .from("share_links")
      .select("token, visibility, mockups!inner(version_group)")
      .eq("mockups.version_group", group)
      .limit(1)
      .maybeSingle();
    if (existing) link = { token: existing.token as string, visibility: existing.visibility as string };
  }

  if (!link) {
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("share_links")
      .insert({ mockup_id: mockupId, created_by: userData.user!.id })
      .select("token, visibility")
      .single();
    if (error) return { error: error.message };
    link = created as { token: string; visibility: string };
  }

  const { data: members } = await supabase
    .from("project_members")
    .select("role, profiles(id, name, email)")
    .eq("project_id", projectId);
  const { data: invites } = await supabase
    .from("invitations")
    .select("email, role")
    .eq("project_id", projectId)
    .is("accepted_at", null);

  const invited: Invited[] = [
    ...(members ?? []).map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = m.profiles as any;
      return { id: p?.id ?? null, name: p?.name || p?.email || "Member", email: p?.email ?? "", role: m.role as string, pending: false };
    }),
    ...(invites ?? []).map((i) => ({ id: null, name: i.email, email: i.email, role: i.role as string, pending: true })),
  ];

  return {
    token: link!.token as string,
    visibility: link!.visibility as "public" | "restricted",
    invited,
    workspaceName,
  };
}

export async function setShareVisibility(mockupId: string, visibility: "public" | "restricted") {
  const supabase = await createServerSupabase();

  // One link per file, so the toggle has to find it wherever in the version
  // group it lives. Matching on mockup_id alone silently did nothing when the
  // link had been created from an earlier version.
  const { data: self } = await supabase
    .from("mockups")
    .select("version_group")
    .eq("id", mockupId)
    .maybeSingle();
  const group = (self as { version_group?: string } | null)?.version_group;

  const { data: link } = group
    ? await supabase
        .from("share_links")
        .select("token, mockups!inner(version_group)")
        .eq("mockups.version_group", group)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const query = supabase.from("share_links").update({ visibility });
  const { error } = link
    ? await query.eq("token", (link as { token: string }).token)
    : await query.eq("mockup_id", mockupId);

  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}

export async function inviteToProject(mockupId: string, email: string) {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address" };

  const { supabase, projectId, workspaceId, workspaceName } = await mockupContext(mockupId);
  if (!projectId || !workspaceId) return { error: "File not found" };
  const { data: userData } = await supabase.auth.getUser();
  const inviterName = (userData.user?.user_metadata?.name as string) || "A teammate";

  const { data: profileId } = await supabase.rpc("find_profile_id_by_email", { p_email: clean });

  if (profileId) {
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: profileId, role: "reviewer" });
    if (error && !/duplicate|unique/i.test(error.message)) return { error: error.message };
    try {
      await sendEmail({ to: clean, ...invitation({ inviterName, workspaceName, isNewUser: false }) });
      await supabase.rpc("create_notification", {
        p_user_id: profileId,
        p_actor_id: userData.user!.id,
        p_type: "share",
        p_mockup_id: mockupId,
        p_project_id: projectId,
        p_body: `${inviterName} shared "${workspaceName}" with you`,
      });
    } catch (e) { console.error("[invite] email failed", e); }
    revalidatePath(`/app/mockups/${mockupId}`);
    return { invited: false as const };
  }

  const { error } = await supabase.from("invitations").insert({
    workspace_id: workspaceId,
    project_id: projectId,
    email: clean,
    role: "reviewer",
    invited_by: userData.user!.id,
  });
  if (error) return { error: error.message };
  try {
    await sendEmail({ to: clean, ...invitation({ inviterName, workspaceName, isNewUser: true }) });
  } catch (e) { console.error("[invite] email failed", e); }
  revalidatePath(`/app/mockups/${mockupId}`);
  return { invited: true as const };
}

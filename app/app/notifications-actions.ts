"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { accessGranted } from "@/lib/email/templates";

export type NotificationItem = {
  id: string;
  type: string;
  body: string;
  mockupId: string | null;
  readAt: string | null;
  createdAt: string;
  actorName: string;
  actorEmail: string;
  // access_request only: who is asking, for which project, and whether the
  // request has already been granted (so the row shows a state, not a button).
  projectId: string | null;
  actorId: string | null;
  granted: boolean;
};

export async function getNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { items: [], unreadCount: 0 };

  const { data } = await supabase
    .from("notifications")
    .select("id, type, body, mockup_id, project_id, actor_id, read_at, created_at, actor:actor_id(name, email)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Which access requests have already been granted, so a handled one shows as
  // handled instead of offering the button again.
  const requests = (data ?? []).filter((n) => n.type === "access_request" && n.project_id && n.actor_id);
  const grantedKeys = new Set<string>();
  if (requests.length) {
    const { data: existing } = await supabase
      .from("project_members")
      .select("project_id, user_id")
      .in("project_id", [...new Set(requests.map((n) => n.project_id as string))])
      .in("user_id", [...new Set(requests.map((n) => n.actor_id as string))]);
    for (const r of existing ?? []) grantedKeys.add(`${r.project_id}:${r.user_id}`);
  }

  const items: NotificationItem[] = (data ?? []).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    body: n.body as string,
    mockupId: (n.mockup_id as string) ?? null,
    projectId: (n.project_id as string) ?? null,
    actorId: (n.actor_id as string) ?? null,
    granted: grantedKeys.has(`${n.project_id}:${n.actor_id}`),
    readAt: (n.read_at as string) ?? null,
    createdAt: n.created_at as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorName: ((n as any).actor?.name as string) || "Someone",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorEmail: ((n as any).actor?.email as string) || "",
  }));
  const unreadCount = items.filter((i) => !i.readAt).length;
  return { items, unreadCount };
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userData.user.id)
    .is("read_at", null);
}

// Approve an access request straight from its notification. Loading the row is
// itself the authorization check: the "see own notifications" policy restricts
// SELECT to user_id = auth.uid(), so only someone the request was actually sent
// to can act on it, and the project_members INSERT policy independently requires
// the granter to be a member of that project's workspace.
export async function grantAccessRequest(notificationId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user;
  if (!me) return { error: "Not signed in" };

  const { data: n } = await supabase
    .from("notifications")
    .select("type, project_id, actor_id, mockup_id")
    .eq("id", notificationId)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!n) return { error: "That request is no longer available." };
  if (n.type !== "access_request") return { error: "That isn't an access request." };
  if (!n.project_id || !n.actor_id) return { error: "That request is missing its project." };
  if (n.actor_id === me.id) return { error: "That's your own request." };

  const { error } = await supabase
    .from("project_members")
    .upsert(
      { project_id: n.project_id, user_id: n.actor_id, role: "reviewer" },
      { onConflict: "project_id,user_id", ignoreDuplicates: true },
    );
  if (error) {
    return {
      error: /row-level|policy/i.test(error.message)
        ? "You don't have permission to grant access to this project."
        : error.message,
    };
  }

  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);

  // Tell the requester, in the app and by email. Best-effort: the grant itself
  // has already succeeded and must not be undone by a notification failure.
  const granterName = (me.user_metadata?.name as string) || me.email || "Someone";
  try {
    const [{ data: mk }, { data: requester }] = await Promise.all([
      supabase.from("mockups").select("name").eq("id", n.mockup_id ?? "").maybeSingle(),
      supabase.from("profiles").select("email, name").eq("id", n.actor_id).maybeSingle(),
    ]);
    const fileName = (mk?.name as string) || "a file";

    await supabase.rpc("create_notification", {
      p_user_id: n.actor_id,
      p_actor_id: me.id,
      p_type: "share",
      p_mockup_id: n.mockup_id,
      p_project_id: n.project_id,
      p_body: `${granterName} gave you access to ${fileName}`,
    });

    if (requester?.email) {
      const tpl = accessGranted({
        granterName,
        fileName,
        mockupId: (n.mockup_id as string) ?? "",
      });
      await sendEmail({ to: requester.email as string, ...tpl });
    }
  } catch (e) {
    console.error("[access] grant follow-up failed", e);
  }

  revalidatePath("/app");
  return { ok: true };
}

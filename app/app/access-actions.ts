"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { withPooler } from "@/lib/db/pooler";
import { sendEmail } from "@/lib/email/send";
import { accessRequest } from "@/lib/email/templates";
import { emailLocalPart } from "@/lib/format";

export type AccessRequestResult =
  | { ok: true; already?: boolean }
  | { ok: false; error: string };

// Ask the team that owns a file to let the current user in. The RPC does the
// authorization and the in-app notifications; email is a best-effort extra on
// top, sent over the pooler because the requester has no RLS access to the
// workspace's member list (and must never be handed it).
export async function requestAccess(mockupId: string): Promise<AccessRequestResult> {
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return { ok: false, error: "Sign in to request access." };

  const { data: status, error } = await supabase.rpc("request_mockup_access", { p_mockup: mockupId });
  if (error) return { ok: false, error: error.message };

  switch (status) {
    case "sent":
      break;
    case "already_requested":
      return { ok: true, already: true };
    case "has_access":
      return { ok: false, error: "You already have access — try reloading the page." };
    case "not_found":
      return { ok: false, error: "That file no longer exists." };
    case "no_recipients":
      return { ok: false, error: "Nobody on this workspace can be reached right now." };
    default:
      return { ok: false, error: "Could not send the request." };
  }

  const requesterName =
    (user.user_metadata?.name as string) || emailLocalPart(user.email ?? "") || "Someone";
  await emailWorkspace(mockupId, requesterName, user.email ?? "", user.id);
  return { ok: true };
}

// Best-effort: never let an email problem fail a request that already produced
// in-app notifications.
async function emailWorkspace(
  mockupId: string,
  requesterName: string,
  requesterEmail: string,
  requesterId: string,
) {
  try {
    const rows = await withPooler(async (db) => {
      const { rows } = await db.query(
        `select pf.email, mk.name as file_name, pr.name as project_name
           from public.mockups mk
           join public.projects pr on pr.id = mk.project_id
           join public.workspace_members wm on wm.workspace_id = pr.workspace_id
           join public.profiles pf on pf.id = wm.user_id
          where mk.id = $1 and wm.user_id <> $2 and pf.email is not null`,
        [mockupId, requesterId],
      );
      return rows as { email: string; file_name: string; project_name: string }[];
    });
    if (!rows.length) return;

    const tpl = accessRequest({
      requesterName,
      requesterEmail,
      fileName: rows[0].file_name,
      projectName: rows[0].project_name,
    });
    await Promise.allSettled(rows.map((r) => sendEmail({ to: r.email, ...tpl })));
  } catch (e) {
    console.error("[access] request email failed", e);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { commentNotification } from "@/lib/email/templates";
import { workspaceSlackWebhook, postToSlack, commentSlackMessage } from "@/lib/slack";
import { sanitizeCommentHtml, htmlToPlainText } from "@/lib/sanitize";

// x,y anchor the pin. w,h are optional and describe a dragged REGION extending
// right/down from that anchor; 0,0 means a plain point pin.
export async function createPin(
  mockupId: string,
  x: number,
  y: number,
  device: "desktop" | "mobile" = "desktop",
  w = 0,
  h = 0,
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const { data, error } = await supabase
    .from("pins")
    .insert({
      mockup_id: mockupId,
      x,
      y,
      w: clamp(w),
      h: clamp(h),
      device,
      created_by: userData.user!.id,
    })
    .select("id, number")
    .single();
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return { id: data.id as string, number: data.number as number };
}

export async function addComment(
  mockupId: string,
  pinId: string,
  body: string,
  parentCommentId?: string,
  attachments?: { path: string; type: "image" | "pdf"; name: string }[],
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const author = userData.user!;
  const cleanBody = sanitizeCommentHtml(body);
  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      pin_id: pinId,
      author_id: author.id,
      body: cleanBody,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (attachments?.length && inserted?.id) {
    try {
      await supabase.from("comment_attachments").insert(
        attachments.map((a) => ({ comment_id: inserted.id, file_path: a.path, type: a.type, name: a.name })),
      );
    } catch (e) {
      console.error("[comment] attachment insert failed", e);
    }
  }

  // Notify the team AFTER the response is sent, so posting a comment returns
  // immediately instead of blocking on N sequential emails + notifications.
  // Best-effort: never fails or delays the comment.
  after(async () => {
    try {
      const { data: mk } = await supabase
        .from("mockups")
        .select("name, project_id, projects(workspace_id)")
        .eq("id", mockupId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const workspaceId = (mk as any)?.projects?.workspace_id as string | undefined;
      const projectId = mk?.project_id as string | undefined;
      if (!mk || (!workspaceId && !projectId)) return;

      const [{ data: wm }, { data: pm }] = await Promise.all([
        supabase.from("workspace_members").select("profiles(id, name, email)").eq("workspace_id", workspaceId ?? ""),
        supabase.from("project_members").select("profiles(id, name, email)").eq("project_id", projectId ?? ""),
      ]);
      const recipients = new Map<string, { id: string; name: string; email: string }>();
      for (const row of [...(wm ?? []), ...(pm ?? [])]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (row as any).profiles;
        if (p?.id && p.id !== author.id && p.email) {
          recipients.set(p.email, { id: p.id, name: p.name ?? "there", email: p.email });
        }
      }
      const commenterName = (author.user_metadata?.name as string) || author.email || "Someone";
      const plain = htmlToPlainText(cleanBody);
      // fan out in parallel rather than one-at-a-time
      await Promise.all(
        [...recipients.values()].map(async (r) => {
          const tpl = commentNotification({
            recipientName: r.name,
            commenterName,
            mockupName: mk.name as string,
            body: plain,
            mockupId,
          });
          await Promise.allSettled([
            sendEmail({ to: r.email, ...tpl }),
            supabase.rpc("create_notification", {
              p_user_id: r.id,
              p_actor_id: author.id,
              p_type: "comment",
              p_mockup_id: mockupId,
              p_project_id: projectId ?? null,
              p_body: `${commenterName} commented on ${mk.name as string}`,
            }),
          ]);
        }),
      );

      // Slack (best-effort): post the comment to the workspace's channel.
      if (workspaceId) {
        const webhook = await workspaceSlackWebhook(supabase, workspaceId);
        if (webhook) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";
          await postToSlack(
            webhook,
            commentSlackMessage({
              commenter: commenterName,
              mockupName: mk.name as string,
              body: plain,
              href: `${appUrl}/app/mockups/${mockupId}`,
            }),
          );
        }
      }
    } catch (e) {
      console.error("[comment] notification failed", e);
    }
  });

  revalidatePath(`/app/mockups/${mockupId}`);
  return { body: cleanBody };
}

export async function setPinStatus(
  mockupId: string,
  pinId: string,
  status: "active" | "resolved",
) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("pins").update({ status }).eq("id", pinId);
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}

// Delete a whole comment thread (the pin + its comments, via cascade).
export async function deletePin(mockupId: string, pinId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("pins").delete().eq("id", pinId);
  if (error) return { error: error.message };
  revalidatePath(`/app/mockups/${mockupId}`);
  return {};
}

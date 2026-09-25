"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { workspaceSlackWebhook, postToSlack } from "@/lib/slack";
import { getCurrentWorkspace } from "./actions";

export async function getSlackConnection(): Promise<{ connected: boolean }> {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { connected: false };
  const { data } = await supabase
    .from("workspace_integrations")
    .select("slack_webhook_cipher")
    .eq("workspace_id", ws.id)
    .maybeSingle();
  return { connected: !!data?.slack_webhook_cipher };
}

export async function setSlackWebhook(url: string) {
  const clean = url.trim();
  if (!/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(clean)) {
    return { error: "Paste a valid Slack incoming webhook URL (https://hooks.slack.com/services/…)." };
  }
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();

  let cipher: string, iv: string;
  try {
    ({ cipher, iv } = encryptSecret(clean));
  } catch {
    return { error: "Server is missing the encryption secret." };
  }

  const { error } = await supabase.from("workspace_integrations").upsert(
    {
      workspace_id: ws.id,
      slack_webhook_cipher: cipher,
      slack_webhook_iv: iv,
      connected_by: userData.user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
  if (error) {
    return {
      error: /row-level|policy/i.test(error.message)
        ? "Only workspace owners or admins can connect Slack."
        : error.message,
    };
  }
  revalidatePath("/app/settings");
  return {};
}

export async function disconnectSlack() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { error } = await supabase
    .from("workspace_integrations")
    .update({ slack_webhook_cipher: null, slack_webhook_iv: null })
    .eq("workspace_id", ws.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return {};
}

export async function sendTestSlack() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const url = await workspaceSlackWebhook(supabase, ws.id);
  if (!url) return { error: "Connect Slack first." };
  const ok = await postToSlack(url, {
    text: "MarkItUp is connected 🎉",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: ":white_check_mark: *MarkItUp is connected to this channel.* You'll get a message here whenever a client comments on a file. Your own team's comments stay quiet." } },
    ],
  });
  return ok ? {} : { error: "Slack rejected the message — double-check the webhook URL." };
}

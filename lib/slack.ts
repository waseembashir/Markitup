import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto";

// How long a burst of comments stays open. Everything a person says about one
// project inside this window is announced once, not once per comment.
export const SLACK_BATCH_WINDOW_MINUTES = 15;

export async function workspaceSlackWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_integrations")
    .select("slack_webhook_cipher, slack_webhook_iv")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data?.slack_webhook_cipher || !data?.slack_webhook_iv) return null;
  try {
    return decryptSecret(data.slack_webhook_cipher, data.slack_webhook_iv);
  } catch {
    return null;
  }
}

export async function postToSlack(webhook: string, payload: object): Promise<boolean> {
  try {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch (e) {
    console.error("[slack] post failed", e);
    return false;
  }
}

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

// The first comment of a burst: who, which project, and what they said.
export function commentSlackMessage(opts: {
  commenter: string;
  projectName: string;
  mockupName: string;
  body: string;
  href: string;
}) {
  const snippet = esc(opts.body).slice(0, 300) || "(no text)";
  return {
    text: `${opts.commenter} commented on ${opts.projectName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:speech_balloon: *${esc(opts.commenter)}* commented on *${esc(opts.projectName)}*  ·  ${esc(opts.mockupName)}`,
        },
      },
      { type: "section", text: { type: "mrkdwn", text: `>${snippet}` } },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "View & reply" }, url: opts.href }],
      },
    ],
  };
}

// Everything else said in the same burst, as one message. No quote here: picking
// one comment out of several would misrepresent the rest.
export function commentRollupSlackMessage(opts: {
  commenter: string;
  projectName: string;
  count: number;
  href: string;
}) {
  const many = opts.count === 1 ? "1 more comment" : `${opts.count} more comments`;
  return {
    text: `${opts.commenter} left ${many} on ${opts.projectName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:speech_balloon: *${esc(opts.commenter)}* left *${many}* on *${esc(opts.projectName)}*`,
        },
      },
      {
        type: "actions",
        elements: [{ type: "button", text: { type: "plain_text", text: "Read them" }, url: opts.href }],
      },
    ],
  };
}

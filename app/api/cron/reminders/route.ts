import { NextRequest } from "next/server";
import { withPooler } from "@/lib/db/pooler";
import { sendEmail } from "@/lib/email/send";
import { reminderEmail, neverRespondedEmail } from "@/lib/email/templates";
import { fillTemplate } from "@/lib/reminders";
import { decryptSecret } from "@/lib/crypto";
import { postToSlack, commentRollupSlackMessage, SLACK_BATCH_WINDOW_MINUTES } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

// Daily job: send the next feedback reminder to clients who haven't responded.
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET not configured" }, 500);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const summary = { processed: 0, sent: 0, responded: 0, done: 0, skipped_weekend: 0, slack_rollups: 0 };

  try {
    await withPooler(async (db) => {
      const { rows } = await db.query(`
        select s.id, s.mockup_id, s.recipient_email, s.recipient_name, s.share_token,
               s.sent_count, s.created_at,
               rs.days_between, rs.max_count, rs.stop_on_feedback, rs.weekdays_only,
               rs.cc_me, rs.notify_never, rs.subject, rs.message, rs.button_label,
               m.name as page_name, p.name as project_name,
               ow.email as owner_email, ow.name as owner_name
        from public.reminder_schedules s
        join public.reminder_settings rs on rs.workspace_id = s.workspace_id and rs.enabled = true
        left join public.mockups m on m.id = s.mockup_id
        left join public.projects p on p.id = m.project_id
        left join public.workspaces w on w.id = s.workspace_id
        left join public.profiles ow on ow.id = w.owner_id
        where s.status = 'active' and s.next_due_at <= now()
        order by s.next_due_at asc
        limit 100
      `);

      const dow = new Date().getUTCDay(); // 0 Sun … 6 Sat
      const isWeekend = dow === 0 || dow === 6;

      for (const r of rows) {
        summary.processed++;

        // Stop if the client already left feedback (any comment after we started).
        if (r.stop_on_feedback) {
          const { rows: fb } = await db.query(
            `select count(*)::int as c from public.comments c
             join public.pins pn on pn.id = c.pin_id
             where pn.mockup_id = $1 and c.created_at > $2`,
            [r.mockup_id, r.created_at],
          );
          if ((fb[0]?.c ?? 0) > 0) {
            await db.query(`update public.reminder_schedules set status='responded' where id=$1`, [r.id]);
            summary.responded++;
            continue;
          }
        }

        // Weekdays-only: leave it for the next run (it stays due).
        if (r.weekdays_only && isWeekend) {
          summary.skipped_weekend++;
          continue;
        }

        // Reached the max — close it out and optionally tell the owner.
        if (r.sent_count >= r.max_count) {
          await db.query(`update public.reminder_schedules set status='done' where id=$1`, [r.id]);
          summary.done++;
          if (r.notify_never && r.owner_email && r.mockup_id) {
            const tpl = neverRespondedEmail({
              pageName: r.page_name ?? "your design",
              clientEmail: r.recipient_email,
              href: `${APP_URL}/app/mockups/${r.mockup_id}`,
            });
            await sendEmail({ to: r.owner_email, ...tpl });
          }
          continue;
        }

        // Send the next reminder.
        const vars = {
          page_name: r.page_name ?? "your design",
          sender: r.owner_name || "Your designer",
          type: "mockup",
          project: r.project_name ?? "",
        };
        const tpl = reminderEmail({
          subject: fillTemplate(r.subject, vars),
          message: fillTemplate(r.message, vars),
          buttonLabel: r.button_label,
          href: `${APP_URL}/s/${r.share_token}`,
        });
        await sendEmail({
          to: r.recipient_email,
          cc: r.cc_me ? r.owner_email ?? undefined : undefined,
          ...tpl,
        });
        summary.sent++;

        const newSent = r.sent_count + 1;
        const status = newSent >= r.max_count ? "done" : "active";
        await db.query(
          `update public.reminder_schedules
           set sent_count=$2, last_sent_at=now(), next_due_at=now() + make_interval(days => $3::int), status=$4
           where id=$1`,
          [r.id, newSent, r.days_between, status],
        );
        if (status === "done") summary.done++;
      }
    });
  } catch (e) {
    console.error("[cron/reminders] failed", e);
    return json({ error: (e as Error).message, summary }, 500);
  }

  // Backstop for Slack comment roll-ups. A burst is normally flushed by the next
  // comment in that workspace, but a client's LAST burst has nothing following
  // it — this catches those. Failures here must not fail the reminder run.
  try {
    summary.slack_rollups = await flushSlackRollups();
  } catch (e) {
    console.error("[cron/reminders] slack roll-up flush failed", e);
  }

  return json({ ok: true, ...summary }, 200);
}

// Post one roll-up per burst that has gone quiet, across every workspace.
async function flushSlackRollups(): Promise<number> {
  return withPooler(async (db) => {
    const { rows } = await db.query(
      `select b.workspace_id, b.project_id, b.author_id, b.mockup_id, b.project_name, b.author_name, b.pending,
              wi.slack_webhook_cipher, wi.slack_webhook_iv
         from public.slack_comment_batches b
         join public.workspace_integrations wi on wi.workspace_id = b.workspace_id
        where b.pending > 0
          and b.last_comment_at <= now() - make_interval(mins => $1::int)
          and wi.slack_webhook_cipher is not null`,
      [SLACK_BATCH_WINDOW_MINUTES],
    );
    if (!rows.length) return 0;

    let posted = 0;
    for (const r of rows) {
      // Clear first: a failed post is better than a duplicate one on the next run.
      await db.query(
        `update public.slack_comment_batches
            set pending = 0, last_posted_at = now()
          where workspace_id = $1 and project_id = $2 and author_id = $3`,
        [r.workspace_id, r.project_id, r.author_id],
      );
      let webhook: string;
      try {
        webhook = decryptSecret(r.slack_webhook_cipher, r.slack_webhook_iv);
      } catch {
        continue;
      }
      const ok = await postToSlack(
        webhook,
        commentRollupSlackMessage({
          commenter: r.author_name,
          projectName: r.project_name,
          count: r.pending,
          href: r.mockup_id
            ? `${APP_URL}/app/mockups/${r.mockup_id}`
            : `${APP_URL}/app/projects/${r.project_id}`,
        }),
      );
      if (ok) posted++;
    }
    return posted;
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

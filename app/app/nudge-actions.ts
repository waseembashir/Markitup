"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { sendEmail } from "@/lib/email/send";
import { reminderEmail } from "@/lib/email/templates";
import { fillTemplate, REMINDER_DEFAULTS, type ReminderSettings } from "@/lib/reminders";
import { emailLocalPart } from "@/lib/format";
import { reportIssue } from "@/lib/observability";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://markitup-woad.vercel.app";

export type NudgePreview = {
  projectName: string;
  pageName: string;
  /** Where the client lands — the share link when there is one. */
  href: string;
  subject: string;
  message: string;
  buttonLabel: string;
  sender: string;
  /** Who it goes to, remembered from the last time this project was sent. */
  recipientEmail: string;
  recipientName: string;
  remindersSent: number;
  lastSentAt: string | null;
  /** Reminders are off for the workspace: this one send still goes out. */
  autoOff: boolean;
  /** No file to point at, so there is nothing to remind anyone about. */
  blocked?: string;
};

type Target = {
  workspaceId: string;
  projectName: string;
  mockupId: string;
  pageName: string;
  token: string | null;
};

// The file a reminder should point at: the newest one in the project that has
// been shared, else simply the newest.
async function targetFor(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  projectId: string,
): Promise<Target | null> {
  const { data: proj } = await supabase
    .from("projects")
    .select("name, workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) return null;

  const { data: mockups } = await supabase
    .from("mockups")
    .select("id, name, created_at")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!mockups?.length) return null;

  const ids = mockups.map((m) => m.id as string);
  const { data: links } = await supabase.from("share_links").select("mockup_id, token").in("mockup_id", ids);
  const tokenOf = new Map((links ?? []).map((l) => [l.mockup_id as string, l.token as string]));
  const shared = mockups.find((m) => tokenOf.has(m.id as string)) ?? mockups[0];

  return {
    workspaceId: proj.workspace_id as string,
    projectName: (proj.name as string) ?? "",
    mockupId: shared.id as string,
    pageName: (shared.name as string) ?? "your design",
    token: tokenOf.get(shared.id as string) ?? null,
  };
}

async function settingsFor(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  workspaceId: string,
): Promise<ReminderSettings> {
  const { data } = await supabase.from("reminder_settings").select("*").eq("workspace_id", workspaceId).maybeSingle();
  return data ? ({ ...REMINDER_DEFAULTS, ...data } as ReminderSettings) : { ...REMINDER_DEFAULTS };
}

/** What this project's reminder would say, and who it would go to. */
export async function getNudgePreview(projectId: string): Promise<NudgePreview> {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const sender =
    (userData.user?.user_metadata?.name as string) || emailLocalPart(userData.user?.email ?? "") || "Your designer";

  const empty: NudgePreview = {
    projectName: "",
    pageName: "",
    href: `${APP_URL}/app`,
    subject: "",
    message: "",
    buttonLabel: REMINDER_DEFAULTS.button_label,
    sender,
    recipientEmail: "",
    recipientName: "",
    remindersSent: 0,
    lastSentAt: null,
    autoOff: true,
  };

  const target = await targetFor(supabase, projectId);
  if (!target) return { ...empty, blocked: "This project has no files yet, so there is nothing to remind anyone about." };

  const settings = await settingsFor(supabase, target.workspaceId);
  const vars = { page_name: target.pageName, sender, type: "file", project: target.projectName };

  const { data: sched } = await supabase
    .from("reminder_schedules")
    .select("recipient_email, recipient_name, sent_count, last_sent_at")
    .eq("mockup_id", target.mockupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    projectName: target.projectName,
    pageName: target.pageName,
    href: target.token ? `${APP_URL}/s/${target.token}` : `${APP_URL}/app/mockups/${target.mockupId}`,
    subject: fillTemplate(settings.subject, vars),
    message: fillTemplate(settings.message, vars),
    buttonLabel: settings.button_label,
    sender,
    recipientEmail: (sched?.recipient_email as string) ?? "",
    recipientName: (sched?.recipient_name as string) ?? "",
    remindersSent: (sched?.sent_count as number) ?? 0,
    lastSentAt: (sched?.last_sent_at as string) ?? null,
    autoOff: !settings.enabled,
  };
}

/**
 * Send this project's reminder now, to whoever the dialog says. The share link
 * is made public first, because a reminder that lands on a locked file is
 * worse than no reminder at all.
 */
export async function sendNudge(projectId: string, email: string, name?: string) {
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Enter a valid email address" };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: "Sign in again to send this" };

  const target = await targetFor(supabase, projectId);
  if (!target) return { error: "This project has no files to point at" };

  const ws = await getCurrentWorkspace();
  if (ws?.id && ws.id !== target.workspaceId) return { error: "That project is in another workspace" };

  let token = target.token;
  if (!token) {
    const { data: created, error } = await supabase
      .from("share_links")
      .insert({ mockup_id: target.mockupId, created_by: userId, visibility: "public" })
      .select("token")
      .single();
    if (error) return { error: error.message };
    token = created.token as string;
  } else {
    await supabase.from("share_links").update({ visibility: "public" }).eq("mockup_id", target.mockupId);
  }

  const settings = await settingsFor(supabase, target.workspaceId);
  const sender =
    (userData.user?.user_metadata?.name as string) || emailLocalPart(userData.user?.email ?? "") || "Your designer";
  const vars = { page_name: target.pageName, sender, type: "file", project: target.projectName };
  const href = `${APP_URL}/s/${token}`;

  const sent = await sendEmail({
    to: clean,
    ...reminderEmail({
      subject: fillTemplate(settings.subject, vars),
      message: fillTemplate(settings.message, vars),
      buttonLabel: settings.button_label,
      href,
    }),
  });
  if (!sent.ok) {
    reportIssue("A reminder could not be sent from the dashboard", { projectId });
    return { error: "The email couldn't be sent — check email delivery in Settings." };
  }

  // Keep the schedule in step: the follow-up clock restarts from this send, and
  // a project that was never sent gets a row so the next one knows who to ask.
  const now = new Date().toISOString();
  const nextDue = new Date(Date.now() + settings.days_between * 24 * 3600 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("reminder_schedules")
    .select("id, sent_count")
    .eq("mockup_id", target.mockupId)
    .eq("recipient_email", clean)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("reminder_schedules")
      .update({
        sent_count: ((existing.sent_count as number) ?? 0) + 1,
        last_sent_at: now,
        next_due_at: nextDue,
        // a manual nudge revives a schedule that had finished its run
        status: settings.enabled ? "active" : "stopped",
      })
      .eq("id", existing.id as string);
  } else {
    await supabase.from("reminder_schedules").insert({
      workspace_id: target.workspaceId,
      mockup_id: target.mockupId,
      recipient_email: clean,
      recipient_name: name?.trim() || null,
      share_token: token,
      created_by: userId,
      sent_count: 1,
      last_sent_at: now,
      next_due_at: nextDue,
      status: settings.enabled ? "active" : "stopped",
    });
  }

  revalidatePath("/app");
  return { ok: true, sentTo: clean, autoOff: !settings.enabled };
}

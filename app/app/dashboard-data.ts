import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { htmlToPlainText } from "@/lib/sanitize";

export type ProjectStats = { mockups: number; comments: number; resolved: number };

export type Viewer = { name: string; email: string };
export type ProjectViewers = { viewers: Viewer[]; lastAt: string | null };
export type Activity = {
  kind: "view" | "comment";
  actor: string;
  email: string;
  mockupId: string;
  mockupName: string;
  project: string;
  at: string;
  snippet?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function one(x: any) {
  return Array.isArray(x) ? x[0] : x;
}

export type ProjectItem = {
  id: string;
  name: string;
  coverUrl?: string;
  coverIsHtml?: boolean;
  updatedAt: string;
  stats: ProjectStats;
  viewers?: Viewer[];
  lastViewedAt?: string | null;
};

// Everything the dashboard + Projects page need for the project grid, in one
// call: cards with covers, stats and "who viewed", plus the recent-activity
// feed and the stats map (for workspace totals).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProjectItems(supabase: SupabaseClient<any>, workspaceId: string) {
  const { data } = await supabase
    .from("projects")
    .select("id, name, created_at, mockups(id, file_path, created_at, type)")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (data ?? []) as any[];
  const ids = projects.map((p) => p.id);

  const [stats, activity, covers] = await Promise.all([
    getWorkspaceStats(supabase, ids),
    getActivityData(supabase, ids),
    signCovers(
      supabase,
      projects.map((p) => [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.file_path).filter(Boolean) as string[],
    ),
  ]);

  const zero: ProjectStats = { mockups: 0, comments: 0, resolved: 0 };
  const items: ProjectItem[] = projects.map((p) => {
    const latest = [...p.mockups].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const pv = activity.viewersByProject.get(p.id);
    return {
      id: p.id,
      name: p.name,
      coverUrl: latest ? covers.get(latest.file_path) : undefined,
      coverIsHtml: latest?.type === "html",
      updatedAt: p.created_at,
      stats: stats.get(p.id) ?? zero,
      viewers: pv?.viewers,
      lastViewedAt: pv?.lastAt,
    };
  });

  return { items, recent: activity.recent, stats };
}

// Who has viewed each project (distinct, latest first) + a workspace-wide
// recent activity feed (views + comments), in a couple of queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActivityData(supabase: SupabaseClient<any>, projectIds: string[]) {
  const viewersByProject = new Map<string, ProjectViewers>();
  let recent: Activity[] = [];
  if (!projectIds.length) return { viewersByProject, recent };

  const { data: mks } = await supabase.from("mockups").select("id, name, project_id").in("project_id", projectIds);
  const mkList = (mks ?? []) as { id: string; name: string; project_id: string }[];
  if (!mkList.length) return { viewersByProject, recent };
  const mkMap = new Map(mkList.map((m) => [m.id, m]));
  const mkIds = mkList.map((m) => m.id);

  const { data: projRows } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const projMap = new Map((projRows ?? []).map((p) => [p.id, p.name as string]));
  const projectOf = (mkId: string) => projMap.get(mkMap.get(mkId)?.project_id ?? "") ?? "";

  const [{ data: views }, { data: comments }] = await Promise.all([
    supabase
      .from("mockup_views")
      .select("viewed_at, mockup_id, profiles:user_id(id, name, email)")
      .in("mockup_id", mkIds)
      .order("viewed_at", { ascending: false })
      .limit(200),
    supabase
      .from("comments")
      .select("created_at, body, pins!inner(mockup_id), profiles:author_id(name, email)")
      .in("pins.mockup_id", mkIds)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  // distinct viewers per project
  const seen = new Map<string, Set<string>>();
  for (const v of views ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = one((v as any).profiles);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mk = mkMap.get((v as any).mockup_id);
    if (!mk || !p?.id) continue;
    let pv = viewersByProject.get(mk.project_id);
    if (!pv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pv = { viewers: [], lastAt: (v as any).viewed_at };
      viewersByProject.set(mk.project_id, pv);
      seen.set(mk.project_id, new Set());
    }
    const s = seen.get(mk.project_id)!;
    if (!s.has(p.id) && pv.viewers.length < 6) {
      s.add(p.id);
      pv.viewers.push({ name: p.name || p.email || "Someone", email: p.email ?? "" });
    }
  }

  // merge recent views + comments
  const viewItems: Activity[] = (views ?? []).slice(0, 15).map((v) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = one((v as any).profiles);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mk = mkMap.get((v as any).mockup_id);
    return {
      kind: "view" as const,
      actor: p?.name || p?.email || "Someone",
      email: p?.email ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockupId: (v as any).mockup_id,
      mockupName: mk?.name ?? "a file",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      project: projectOf((v as any).mockup_id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      at: (v as any).viewed_at,
    };
  });
  const commentItems: Activity[] = (comments ?? []).map((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = one((c as any).profiles);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mkId = one((c as any).pins)?.mockup_id as string | undefined;
    const mk = mkId ? mkMap.get(mkId) : undefined;
    return {
      kind: "comment" as const,
      actor: p?.name || p?.email || "Someone",
      email: p?.email ?? "",
      mockupId: mkId ?? "",
      mockupName: mk?.name ?? "a file",
      project: mkId ? projectOf(mkId) : "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      at: (c as any).created_at,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snippet: htmlToPlainText((c as any).body ?? "").slice(0, 90),
    };
  });
  recent = [...viewItems, ...commentItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return { viewersByProject, recent };
}

export type FeedbackRow = {
  projectId: string;
  files: number;
  threads: number;
  openThreads: number;
  comments: number;
  sharedAt: string | null;
  clientViewers: number;
  lastClientView: string | null;
  lastClientComment: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  remindersSent: number;
  lastReminderAt: string | null;
  latestMockupId: string | null;
};

// One row per project for the dashboard's table: the counts, who outside the
// team has looked, and the last reminder that went out. See
// 0042_project_feedback_rows.sql.
export async function getFeedbackRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectIds: string[],
) {
  const map = new Map<string, FeedbackRow>();
  if (!projectIds.length) return map;

  const { data, error } = await supabase.rpc("project_feedback_rows", { p: projectIds });
  // The table is an addition to a working dashboard: if the function isn't
  // there yet, the page still renders with the counts it already had.
  if (error) return map;

  for (const r of (data ?? []) as Record<string, unknown>[]) {
    map.set(r.project_id as string, {
      projectId: r.project_id as string,
      files: (r.files as number) ?? 0,
      threads: (r.threads as number) ?? 0,
      openThreads: (r.open_threads as number) ?? 0,
      comments: (r.comments as number) ?? 0,
      sharedAt: (r.shared_at as string) ?? null,
      clientViewers: (r.client_viewers as number) ?? 0,
      lastClientView: (r.last_client_view as string) ?? null,
      lastClientComment: (r.last_client_comment as string) ?? null,
      recipientEmail: (r.recipient_email as string) ?? null,
      recipientName: (r.recipient_name as string) ?? null,
      remindersSent: (r.reminders_sent as number) ?? 0,
      lastReminderAt: (r.last_reminder_at as string) ?? null,
      latestMockupId: (r.latest_mockup_id as string) ?? null,
    });
  }
  return map;
}

/** Someone outside the team who opened a file — enough to draw a face. */
export type ViewerFace = { name: string; email: string };

export type FileRow = {
  mockupId: string;
  projectId: string;
  name: string;
  createdAt: string | null;
  threads: number;
  openThreads: number;
  comments: number;
  sharedAt: string | null;
  clientViewers: number;
  lastClientView: string | null;
  lastClientComment: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  remindersSent: number;
  lastReminderAt: string | null;
  viewers: ViewerFace[];
};

// The same row, one level down: a project's files, newest first, so the table
// can open a project that holds more than one. See 0043_file_feedback_rows.sql.
export async function getFileRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  projectIds: string[],
) {
  const map = new Map<string, FileRow[]>();
  if (!projectIds.length) return map;

  const { data, error } = await supabase.rpc("mockup_feedback_rows", { p: projectIds });
  // Same bargain as getFeedbackRows: without the function the table still
  // renders, one row per project, with no files underneath.
  if (error) return map;

  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const raw = Array.isArray(r.viewers) ? (r.viewers as { name?: string; email?: string }[]) : [];
    const row: FileRow = {
      mockupId: r.mockup_id as string,
      projectId: r.project_id as string,
      name: (r.name as string) ?? "Untitled",
      createdAt: (r.created_at as string) ?? null,
      threads: (r.threads as number) ?? 0,
      openThreads: (r.open_threads as number) ?? 0,
      comments: (r.comments as number) ?? 0,
      sharedAt: (r.shared_at as string) ?? null,
      clientViewers: (r.client_viewers as number) ?? 0,
      lastClientView: (r.last_client_view as string) ?? null,
      lastClientComment: (r.last_client_comment as string) ?? null,
      recipientEmail: (r.recipient_email as string) ?? null,
      recipientName: (r.recipient_name as string) ?? null,
      remindersSent: (r.reminders_sent as number) ?? 0,
      lastReminderAt: (r.last_reminder_at as string) ?? null,
      viewers: raw.map((v) => ({ name: v?.name ?? "", email: v?.email ?? "" })),
    };
    const list = map.get(row.projectId);
    if (list) list.push(row);
    else map.set(row.projectId, [row]);
  }
  return map;
}

/** The faces from a project's files, most recent visit first, each person once. */
export function mergeViewers(files: FileRow[], limit = 5): ViewerFace[] {
  const seen = new Set<string>();
  const out: ViewerFace[] = [];
  const ordered = [...files].sort(
    (a, b) => new Date(b.lastClientView ?? 0).getTime() - new Date(a.lastClientView ?? 0).getTime(),
  );
  for (const f of ordered) {
    for (const v of f.viewers) {
      const key = (v.email || v.name).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getWorkspaceStats(supabase: SupabaseClient<any>, projectIds: string[]) {
  const map = new Map<string, ProjectStats>();
  if (!projectIds.length) return map;

  // One call for every project. This used to fan out into one RPC per project,
  // which meant a workspace with fifty projects opened fifty simultaneous
  // connections on every dashboard load.
  const { data } = await supabase.rpc("project_stats_many", { p: projectIds });
  for (const row of (data ?? []) as {
    project_id: string;
    mockups: number;
    comments: number;
    resolved: number;
  }[]) {
    map.set(row.project_id, {
      mockups: row.mockups ?? 0,
      comments: row.comments ?? 0,
      resolved: row.resolved ?? 0,
    });
  }
  // A project the caller cannot see returns no row; the dashboard renders zeros
  // for it rather than leaving the card blank.
  for (const id of projectIds) if (!map.has(id)) map.set(id, { mockups: 0, comments: 0, resolved: 0 });
  return map;
}

export async function signCovers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  covers: string[],
) {
  const signed = new Map<string, string>();
  const paths = covers.filter(Boolean);
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("mockups").createSignedUrls(paths, 60 * 60);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }
  return signed;
}

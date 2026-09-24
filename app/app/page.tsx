import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { getProjectItems, getFeedbackRows } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { ProjectTable, type TableRow } from "@/components/app/ProjectTable";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

function StatTile({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent ?? "var(--color-ink)" }}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const { items, stats } = await getProjectItems(supabase, ws?.id ?? "");

  let totalMockups = 0, totalThreads = 0, totalResolved = 0;
  for (const s of stats.values()) { totalMockups += s.mockups; totalThreads += s.comments; totalResolved += s.resolved; }
  const openComments = Math.max(0, totalThreads - totalResolved);

  const recentProjects = items.slice(0, 6);
  const feedback = await getFeedbackRows(supabase, recentProjects.map((p) => p.id));
  const tableRows: TableRow[] = recentProjects
    .map((p) => {
      const row = feedback.get(p.id);
      return row ? { ...row, name: p.name } : null;
    })
    .filter((r): r is TableRow => r !== null);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(items.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/members" className="btn-secondary btn-sm">Invite</Link>
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rise-in card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">Head to <Link href="/app/projects" className="font-semibold text-brand-ink">Projects</Link> to create one and start collecting pinned feedback.</p>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={plural(items.length, "project")} value={items.length} />
            <StatTile label={plural(totalMockups, "file")} value={totalMockups} />
            <StatTile label="Open comments" value={openComments} accent={openComments > 0 ? "var(--color-brand)" : undefined} />
            <StatTile label="Resolved" value={totalResolved} accent={totalResolved > 0 ? "var(--color-success)" : undefined} />
          </div>

          {tableRows.length > 0 && (
            <div className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Where each project stands</h2>
                <p className="text-xs text-muted">Client activity, open threads and reminders</p>
              </div>
              <ProjectTable rows={tableRows} />
            </div>
          )}

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Recent projects</h2>
              <Link href="/app/projects" className="text-sm font-medium text-brand-ink transition-colors hover:text-brand-hover">View all →</Link>
            </div>
            <ProjectGrid items={recentProjects} />
          </div>
        </>
      )}
    </div>
  );
}

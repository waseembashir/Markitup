import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMyWorkspaces } from "./actions";
import { getProjectItems, getFeedbackRows, getFileRows, getUnreadClientComments, mergeViewers, type ProjectItem } from "./dashboard-data";
import { emailLocalPart } from "@/lib/format";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { ProjectTable, type TableRow } from "@/components/app/ProjectTable";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";
import { WorkspaceHeading } from "@/components/app/WorkspaceHeading";

const RECENT = 6;

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const [workspaces, { data: authData }] = await Promise.all([getMyWorkspaces(), supabase.auth.getUser()]);
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  // The workspace the app opens — the company's, for anyone at the company —
  // is the one the dashboard is about. Any others sit below it.
  const [team, ...others] = workspaces;
  const [teamData, ...otherData] = await Promise.all(workspaces.map((w) => getProjectItems(supabase, w.id)));
  const items: ProjectItem[] = teamData?.items ?? [];

  const tableIds = items.map((p) => p.id);
  const [feedback, filesByProject, unread] = await Promise.all([
    getFeedbackRows(supabase, tableIds),
    getFileRows(supabase, tableIds),
    getUnreadClientComments(supabase, tableIds),
  ]);
  const tableRows: TableRow[] = items
    .map((p): TableRow | null => {
      const row = feedback.get(p.id);
      if (!row) return null;
      const u = unread.get(p.id);
      const fileRows = (filesByProject.get(p.id) ?? []).map((f) => ({ ...f, unread: u?.byMockup.get(f.mockupId) ?? 0 }));
      return { ...row, name: p.name, fileRows, viewers: mergeViewers(fileRows), unread: u?.count ?? 0, unreadAt: u?.latestAt ?? null };
    })
    .filter((r): r is TableRow => r !== null)
    // A client just said something you haven't read: that project goes to the
    // top, newest first. The rest keep their order.
    .sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || (b.unreadAt ?? "").localeCompare(a.unreadAt ?? ""));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {tableRows.length > 0 && (
        // Squeezed so the workspace below keeps the room: five projects, the
        // columns that matter at a glance; the rest is a click away.
        <div className="mb-8">
          <ProjectTable title="Where each project stands" rows={tableRows} compact />
        </div>
      )}

      {team && (
        // The team's work is the point of the page, so it leads, set apart.
        <section className="mb-8 rounded-2xl border bg-surface p-6">
          <WorkspaceHeading
            ws={team}
            count={items.length}
            action={
              items.length > RECENT ? (
                <Link href="/app/projects" className="text-sm font-semibold text-brand-ink hover:underline">
                  View all {items.length} →
                </Link>
              ) : undefined
            }
          />
          {items.length === 0 ? (
            <div className="card grid place-items-center px-6 py-12 text-center">
              <h3 className="text-base font-semibold">No projects yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted">Create one with New project, upload a file, and start collecting pinned feedback.</p>
            </div>
          ) : (
            <ProjectGrid items={items.slice(0, RECENT)} />
          )}
        </section>
      )}

      {others.map((ws, i) => {
        const wsItems = otherData[i]?.items ?? [];
        return (
          <section key={ws.id} className="mb-10">
            <WorkspaceHeading
              ws={ws}
              count={wsItems.length}
              action={<NewProjectDialog variant="secondary" workspaceId={ws.id} workspaceName={ws.name} />}
            />
            {wsItems.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted">No projects here yet.</p>
            ) : (
              <ProjectGrid items={wsItems.slice(0, RECENT)} />
            )}
          </section>
        );
      })}
    </div>
  );
}

import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "./actions";
import { getProjectItems, getFeedbackRows, getFileRows, getUnreadClientComments, mergeViewers } from "./dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { ProjectTable, type TableRow } from "@/components/app/ProjectTable";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";

export default async function DashboardPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const { items } = await getProjectItems(supabase, ws?.id ?? "");


  const recentProjects = items.slice(0, 6);
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{ws?.name} · {plural(items.length, "project")}</p>
        </div>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
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
          {tableRows.length > 0 && (
            <div className="mb-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Where each project stands</h2>
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

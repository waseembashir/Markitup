import { createServerSupabase } from "@/lib/supabase/server";
import { getMyWorkspaces } from "../actions";
import { getProjectItems } from "../dashboard-data";
import { emailLocalPart } from "@/lib/format";
import { SearchableProjects } from "@/components/app/SearchableProjects";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

export default async function ProjectsPage() {
  const supabase = await createServerSupabase();
  const [workspaces, { data: authData }] = await Promise.all([getMyWorkspaces(), supabase.auth.getUser()]);
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  // Every workspace you belong to, the team's first.
  const data = await Promise.all(workspaces.map((w) => getProjectItems(supabase, w.id)));
  const groups = workspaces.map((w, i) => ({ workspace: w, items: data[i].items }));
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-2">
          <NewProjectDialog />
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {total === 0 ? (
        <div className="rise-in card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects yet</h3>
          <p className="mt-1 mb-4 max-w-sm text-sm text-muted">Create your first project, upload a file, and start collecting pinned feedback.</p>
          <NewProjectDialog />
        </div>
      ) : (
        <SearchableProjects groups={groups} />
      )}
    </div>
  );
}

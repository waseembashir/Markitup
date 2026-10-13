import { createServerSupabase } from "@/lib/supabase/server";
import { getMyWorkspaces } from "../actions";
import { getProjectItems } from "../dashboard-data";
import { emailLocalPart } from "@/lib/format";
import { SearchableProjects } from "@/components/app/SearchableProjects";
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

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ProfileMenu name={userName} email={userEmail} />
        </div>
      </div>

      {/* New project lives in the tabs, so it always lands in the workspace on screen. */}
      <SearchableProjects groups={groups} />
    </div>
  );
}

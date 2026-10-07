import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "../actions";
import { getProjectItems } from "../dashboard-data";
import { plural, emailLocalPart } from "@/lib/format";
import { SearchableProjects } from "@/components/app/SearchableProjects";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";
import { NotificationBell } from "@/components/app/NotificationBell";
import { ProfileMenu } from "@/components/app/ProfileMenu";

export default async function ProjectsPage() {
  const ws = await getCurrentWorkspace();
  const supabase = await createServerSupabase();
  const { data: authData } = await supabase.auth.getUser();
  const userEmail = authData.user?.email ?? "";
  const userName = (authData.user?.user_metadata?.name as string) || emailLocalPart(userEmail) || "";

  const { items } = await getProjectItems(supabase, ws?.id ?? "");

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
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
          <p className="mt-1 mb-4 max-w-sm text-sm text-muted">Create your first project, upload a file, and start collecting pinned feedback.</p>
          <NewProjectDialog />
        </div>
      ) : (
        <SearchableProjects items={items} />
      )}
    </div>
  );
}

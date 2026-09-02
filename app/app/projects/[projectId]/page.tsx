import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { NewSubProjectDialog } from "@/components/app/NewSubProjectDialog";
import { ProjectBrowser, type FileItem } from "@/components/app/ProjectBrowser";
import type { FolderOption } from "@/components/app/MoveToFolderDialog";
import { plural } from "@/lib/format";

function Chevron() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-faint" aria-hidden>
      <path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { projectId } = await params;
  const { folder } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
  // Deleting the project you're viewing used to leave you here on a shell page
  // with no folders and no files — i.e. staring at the upload dropzone. Send
  // people back to the project list instead.
  if (!project) redirect("/app/projects");

  // all folders in the project → drives breadcrumb, current level and move picker
  const { data: folderRows } = await supabase
    .from("mockup_folders")
    .select("id, name, parent_id")
    .eq("project_id", projectId)
    .order("name");
  const allF = (folderRows ?? []) as { id: string; name: string; parent_id: string | null }[];
  const byId = new Map(allF.map((f) => [f.id, f]));
  const currentFolderId = folder && byId.has(folder) ? folder : null;

  // breadcrumb chain (root → current)
  const chain: { id: string; name: string }[] = [];
  {
    let c = currentFolderId ? byId.get(currentFolderId) : null;
    const guard = new Set<string>();
    while (c && !guard.has(c.id)) {
      guard.add(c.id);
      chain.unshift({ id: c.id, name: c.name });
      c = c.parent_id ? byId.get(c.parent_id) ?? null : null;
    }
  }

  const subfolders = allF.filter((f) => (f.parent_id ?? null) === currentFolderId).map((f) => ({ id: f.id, name: f.name }));

  const depthOf = (id: string): number => {
    let d = 0;
    let c = byId.get(id);
    const seen = new Set<string>();
    while (c?.parent_id && !seen.has(c.id)) { seen.add(c.id); d++; c = byId.get(c.parent_id); }
    return d;
  };
  const allFolders: FolderOption[] = allF
    .map((f) => ({ id: f.id, name: f.name, depth: depthOf(f.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // mockups at the current level (root = folder_id null)
  let mq = supabase
    .from("mockups")
    .select("id, name, file_path, created_at, version, version_group, type")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("version", { ascending: false });
  mq = currentFolderId ? mq.eq("folder_id", currentFolderId) : mq.is("folder_id", null);
  const { data: mockups } = await mq;
  const allMockups = mockups ?? [];

  // collapse each version group to its latest version
  const fileMap = new Map<string, (typeof allMockups)[number] & { count: number }>();
  for (const m of allMockups) {
    const g = fileMap.get(m.version_group);
    if (!g) fileMap.set(m.version_group, { ...m, count: 1 });
    else g.count += 1;
  }
  const rows = [...fileMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const signed = new Map<string, string>();
  if (rows.length) {
    const { data: urls } = await supabase.storage.from("mockups").createSignedUrls(rows.map((m) => m.file_path), 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }

  const { data: authData } = await supabase.auth.getUser();
  const meId = authData.user?.id ?? "";
  const ids = rows.map((m) => m.id);
  const viewedIds = new Set<string>();
  if (meId && ids.length) {
    const { data: views } = await supabase.from("mockup_views").select("mockup_id").eq("user_id", meId).in("mockup_id", ids);
    for (const v of views ?? []) viewedIds.add(v.mockup_id as string);
  }

  const files: FileItem[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    url: signed.get(m.file_path) ?? null,
    version: m.version,
    count: m.count,
    isNew: !viewedIds.has(m.id),
    createdAt: m.created_at,
    type: (m.type as string) ?? "image",
  }));

  const here = chain.length ? chain[chain.length - 1].name : project?.name ?? "Project";

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      {/* breadcrumb — only when inside a sub-folder, so you can navigate up */}
      {chain.length > 0 && (
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href={`/app/projects/${projectId}`} className="transition-colors hover:text-brand-ink">{project?.name ?? "Project"}</Link>
          {chain.map((c, i) => (
            <span key={c.id} className="flex items-center gap-2">
              <Chevron />
              <Link href={`/app/projects/${projectId}?folder=${c.id}`} className={i === chain.length - 1 ? "font-semibold text-ink" : "transition-colors hover:text-brand-ink"}>
                {c.name}
              </Link>
            </span>
          ))}
        </nav>
      )}

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{here}</h1>
          <p className="mt-1 text-sm text-muted">{plural(subfolders.length, "project")} · {plural(files.length, "file")}</p>
        </div>
        <NewSubProjectDialog projectId={projectId} parentId={currentFolderId} />
      </div>

      <ProjectBrowser projectId={projectId} currentFolderId={currentFolderId} folders={subfolders} files={files} allFolders={allFolders} />
    </div>
  );
}

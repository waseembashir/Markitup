import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { buildEmbedUrl } from "@/lib/figma";
import { MockupViewer } from "@/components/viewer/MockupViewer";
import { loadViewerPins } from "./pins-data";
import { LockedFile } from "@/components/app/LockedFile";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { NotificationBell } from "@/components/app/NotificationBell";
import { RecentViewers, type Viewer } from "@/components/viewer/RecentViewers";
import { VersionSwitcher } from "@/components/viewer/VersionSwitcher";
import { RecordView } from "@/components/viewer/RecordView";
import { Avatar } from "@/components/app/AppSidebar";
import { emailLocalPart } from "@/lib/format";

export default async function MockupPage({
  params,
  searchParams,
}: {
  params: Promise<{ mockupId: string }>;
  searchParams: Promise<{ pin?: string }>;
}) {
  const { mockupId } = await params;
  // Set when someone follows an earlier version's comment out of the rail, so
  // they land on the thread they clicked rather than the top of the file.
  const { pin: initialPinId } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: mockup } = await supabase
    .from("mockups")
    .select("id, name, file_path, type, project_id, version_group, figma_file_key, figma_node_id, projects(name, workspace_id)")
    .eq("id", mockupId)
    .maybeSingle();
  // RLS returns no row both when the file is missing AND when the viewer simply
  // may not see it, so a bare notFound() here turned every restricted share link
  // into a dead 404. Ask the security-definer preview which case this is.
  if (!mockup) {
    const { data: preview } = await supabase.rpc("mockup_access_preview", { p_mockup: mockupId });
    const row = Array.isArray(preview) ? preview[0] : preview;
    if (!row) notFound();
    const { data: lockedAuth } = await supabase.auth.getUser();
    return (
      <LockedFile
        mockupId={mockupId}
        fileName={row.mockup_name}
        projectName={row.project_name}
        userEmail={lockedAuth.user?.email ?? ""}
      />
    );
  }

  // All non-archived files in this project, used both for version stacking and
  // for prev/next pagination (which walks between files, not versions).
  const { data: projectMockups } = await supabase
    .from("mockups")
    .select("id, created_at, version, version_group")
    .eq("project_id", mockup.project_id)
    .is("archived_at", null)
    .order("version", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pmRows = (projectMockups ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentGroup = (mockup as any).version_group as string;

  // Loaded before the version list, which counts each version's comments from
  // it: this already covers the whole version group, so the switcher needs no
  // query of its own.
  const viewerPins = await loadViewerPins(supabase, mockupId);

  // Versions of THIS file, newest first, for the switcher.
  const versions = pmRows
    .filter((m) => m.version_group === currentGroup)
    .sort((a, b) => b.version - a.version)
    .map((m) => ({
      id: m.id as string,
      version: m.version as number,
      createdAt: m.created_at as string,
      // viewerPins covers the whole version group, so the count for each
      // version is already loaded — no extra query for the dialog.
      commentCount: viewerPins
        .filter((p) => p.mockupId === m.id)
        .reduce((n, p) => n + p.comments.length, 0),
    }));

  // One entry per file (version group) for pagination. `pmRows` is version-desc,
  // so the first row seen per group is its latest version. The current group is
  // represented by the version actually being viewed so pagination stays put.
  const latestByGroup = new Map<string, { id: string; created_at: string }>();
  for (const m of pmRows) {
    if (!latestByGroup.has(m.version_group)) latestByGroup.set(m.version_group, { id: m.id, created_at: m.created_at });
  }
  const siblings = [...latestByGroup.entries()]
    .sort(([, a], [, b]) => a.created_at.localeCompare(b.created_at))
    .map(([grp, g]) => ({ id: grp === currentGroup ? mockupId : g.id }));

  // people who can be @mentioned: workspace team + project reviewers/editors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (mockup as any).projects?.workspace_id as string | undefined;
  const [{ data: wm }, { data: pm }] = await Promise.all([
    supabase.from("workspace_members").select("profiles(id, name)").eq("workspace_id", workspaceId ?? ""),
    supabase.from("project_members").select("profiles(id, name)").eq("project_id", mockup.project_id),
  ]);
  const memberMap = new Map<string, { id: string; name: string }>();
  for (const row of [...(wm ?? []), ...(pm ?? [])]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (row as any).profiles;
    if (p?.id && p?.name) memberMap.set(p.id, { id: p.id, name: p.name });
  }
  const members = [...memberMap.values()];

  const { data: viewRows } = await supabase
    .from("mockup_views")
    .select("viewed_at, profiles:user_id(id, name, email)")
    .eq("mockup_id", mockupId)
    .order("viewed_at", { ascending: false })
    .limit(8);
  const viewers: Viewer[] = (viewRows ?? [])
    .map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (r as any).profiles;
      return { id: p?.id ?? "", name: p?.name || "Someone", email: p?.email ?? "", viewedAt: r.viewed_at as string };
    })
    .filter((v) => v.id);

  const { data: authData } = await supabase.auth.getUser();
  const currentUserName =
    (authData.user?.user_metadata?.name as string) ||
    emailLocalPart(authData.user?.email ?? "") ||
    "You";
  const currentUserEmail = authData.user?.email ?? "";
  const currentUserId = authData.user?.id ?? null;
  // A guest arrived through a public link: no account, so sharing, notifications,
  // the profile menu and uploading are all dead ends for them.
  const isGuest = authData.user?.is_anonymous === true;

  const url = await getMockupSignedUrl(mockup.file_path);

  // Live Figma embed (the animated prototype) is shown to ANY signed-in viewer
  // who can open this mockup — the workspace team AND invited/joined project
  // reviewers (clients). This page is auth-gated (the /app layout) and
  // RLS-gated (the mockup only loads if the viewer can see its project), so
  // only legitimate project members reach it. Trade-off accepted by the owner:
  // a PUBLIC share link auto-joins whoever opens it as a reviewer, so a public
  // link exposes the embed (and thus the Figma file key) to anyone with it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mk = mockup as any;
  const figmaEmbedUrl =
    mockup.type === "figma" && mk.figma_file_key && authData.user
      ? buildEmbedUrl(mk.figma_file_key as string, (mk.figma_node_id as string) ?? "")
      : null;

  const titleSlot = (
    <>
      <Link
        href={`/app/projects/${mockup.project_id}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
        aria-label="Back to project"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <h1 className="truncate text-sm font-bold text-ink">{mockup.name}</h1>
      <VersionSwitcher versions={versions} currentId={mockupId} projectId={mockup.project_id} canUpload={!isGuest} />
    </>
  );
  const actionsSlot = isGuest ? (
    <>
      <RecentViewers viewers={viewers} />
      <span className="ml-1 flex items-center gap-2 text-sm font-semibold text-ink">
        <Avatar name={currentUserName} email={currentUserEmail} size={26} />
        <span className="max-w-32 truncate">{currentUserName}</span>
      </span>
    </>
  ) : (
    <>
      <RecentViewers viewers={viewers} />
      <ShareDialog mockupId={mockupId} />
      <NotificationBell />
      <ProfileMenu name={currentUserName} email={currentUserEmail} />
    </>
  );

  return (
    <div className="flex h-full flex-col">
      <RecordView mockupId={mockupId} />
      <div className="min-h-0 flex-1">
        {url ? (
          <MockupViewer
            mockupId={mockupId}
            projectId={mockup.project_id}
            imageUrl={url}
            imageName={mockup.name}
            initialPins={viewerPins}
            siblings={siblings ?? [{ id: mockupId }]}
            members={members}
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
            currentUserId={currentUserId}
            initialPinId={initialPinId ?? null}
            figmaEmbedUrl={figmaEmbedUrl}
            htmlUrl={mockup.type === "html" ? url : null}
            titleSlot={titleSlot}
            actionsSlot={actionsSlot}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-faint">
            Could not load this file.
          </div>
        )}
      </div>
    </div>
  );
}

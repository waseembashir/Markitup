import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMockupSignedUrl } from "@/app/app/projects/[projectId]/actions";
import { buildEmbedUrl } from "@/lib/figma";
import { MockupViewer, type ViewerPin } from "@/components/viewer/MockupViewer";
import { LockedFile } from "@/components/app/LockedFile";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { ProfileMenu } from "@/components/app/ProfileMenu";
import { NotificationBell } from "@/components/app/NotificationBell";
import { RecentViewers, type Viewer } from "@/components/viewer/RecentViewers";
import { VersionSwitcher } from "@/components/viewer/VersionSwitcher";
import { RecordView } from "@/components/viewer/RecordView";
import { Avatar } from "@/components/app/AppSidebar";
import { emailLocalPart } from "@/lib/format";
import { sanitizeCommentHtml } from "@/lib/sanitize";

export default async function MockupPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
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

  // Versions of THIS file, newest first, for the switcher.
  const versions = pmRows
    .filter((m) => m.version_group === currentGroup)
    .sort((a, b) => b.version - a.version)
    .map((m) => ({ id: m.id as string, version: m.version as number, createdAt: m.created_at as string }));

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

  const { data: pins } = await supabase
    .from("pins")
    .select(
      "id, x, y, w, h, number, status, device, comments(id, body, parent_comment_id, created_at, profiles(name, email), comment_attachments(file_path, type, name))",
    )
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  /* Supabase's untyped client infers nested one-to-many joins loosely (profiles
     comes back as an array, attachments as unknown[]), so these row shapes are
     `any` by necessity rather than by choice. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const attachmentPaths = (pins ?? []).flatMap((p: any) =>
    (p.comments ?? []).flatMap((c: any) =>
      (c.comment_attachments ?? []).map((a: any) => a.file_path as string),
    ),
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: urls } = await supabase.storage
      .from("comment-files")
      .createSignedUrls(attachmentPaths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signedAttachmentUrls.set(u.path, u.signedUrl);
  }

  const { data: viewRows } = await supabase
    .from("mockup_views")
    .select("viewed_at, profiles:user_id(id, name, email)")
    .eq("mockup_id", mockupId)
    .order("viewed_at", { ascending: false })
    .limit(8);
  const viewers: Viewer[] = (viewRows ?? []).map((r) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (r as any).profiles;
    return { id: p?.id ?? "", name: p?.name || "Someone", email: p?.email ?? "", viewedAt: r.viewed_at as string };
  }).filter((v) => v.id);

  const { data: authData } = await supabase.auth.getUser();
  const currentUserName =
    (authData.user?.user_metadata?.name as string) ||
    emailLocalPart(authData.user?.email ?? "") ||
    "You";
  const currentUserEmail = authData.user?.email ?? "";

  const url = await getMockupSignedUrl(mockup.file_path);

  const viewerPins: ViewerPin[] = (pins ?? []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    w: p.w ?? 0,
    h: p.h ?? 0,
    number: p.number,
    status: p.status,
    device: (p.device as "desktop" | "mobile") ?? "desktop",
    // Supabase's untyped client infers nested one-to-many joins loosely (e.g. profiles as an
    // array); `any` here matches the query's actual runtime shape without hand-maintaining a
    // brittle structural type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      // Sanitize at render time too: the comments table is directly writable via
      // RLS by any project member, so a raw body could bypass addComment's write-time
      // sanitize. Idempotent with it, and covers legacy/direct-insert rows.
      body: sanitizeCommentHtml((c.body as string) ?? ""),
      parentCommentId: c.parent_comment_id,
      createdAt: c.created_at,
      authorName: c.profiles?.name || emailLocalPart(c.profiles?.email ?? "") || "Unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: (c.comment_attachments ?? []).map((a: any) => ({
        url: signedAttachmentUrls.get(a.file_path) ?? "",
        type: a.type,
        name: a.name,
      })),
    })),
  }));

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
      <VersionSwitcher versions={versions} currentId={mockupId} projectId={mockup.project_id} />
    </>
  );
  // A guest on a public link has no account, so sharing, notifications and the
  // profile menu are all dead ends for them — they get their name and nothing
  // that leads somewhere they can't go.
  const isGuest = authData.user?.is_anonymous === true;
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

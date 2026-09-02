import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { CompareView, type CompareMockup } from "@/components/viewer/CompareView";
import type { CompareCommentGroup } from "@/components/viewer/CompareComments";
import type { ViewerPin } from "@/components/viewer/MockupViewer";
import { sanitizeCommentHtml } from "@/lib/sanitize";
import { emailLocalPart } from "@/lib/format";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ left?: string; right?: string }>;
}) {
  const { projectId } = await params;
  const { left, right } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: rows } = await supabase
    .from("mockups")
    .select("id, name, file_path, created_at, version")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .neq("type", "html") // compare renders images side-by-side; HTML isn't comparable here
    .order("created_at", { ascending: true });
  const mockups = rows ?? [];

  const signed = new Map<string, string>();
  if (mockups.length) {
    const { data: urls } = await supabase.storage
      .from("mockups")
      .createSignedUrls(mockups.map((m) => m.file_path), 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl);
  }

  const list: CompareMockup[] = mockups
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m) => ({ id: m.id, name: m.name, url: signed.get(m.file_path) ?? "", version: (m as any).version as number | undefined }))
    .filter((m) => m.url);

  const latest = list[list.length - 1];
  const previous = list[list.length - 2] ?? latest;
  const initialLeft = left && list.some((m) => m.id === left) ? left : previous?.id;
  const initialRight = right && list.some((m) => m.id === right) ? right : latest?.id;

  if (list.length < 2) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
          <Link
            href={`/app/projects/${projectId}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
            aria-label="Back to project"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="truncate text-sm font-bold text-ink">Compare · {project.name}</h1>
        </header>
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-faint">
          Add at least two files to this project to compare them side by side.
        </div>
      </div>
    );
  }

  // All comments across every version of this file, for the read-only sidebar.
  const ids = list.map((m) => m.id);
  const { data: pinRows } = await supabase
    .from("pins")
    .select(
      "id, mockup_id, x, y, w, h, number, status, device, comments(id, body, parent_comment_id, created_at, profiles(name, email), comment_attachments(file_path, type, name))",
    )
    .in("mockup_id", ids)
    .order("number", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachmentPaths = (pinRows ?? []).flatMap((p: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p.comments ?? []).flatMap((c: any) => (c.comment_attachments ?? []).map((a: any) => a.file_path as string)),
  );
  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: urls } = await supabase.storage.from("comment-files").createSignedUrls(attachmentPaths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signedAttachmentUrls.set(u.path, u.signedUrl);
  }

  const pinsByMockup = new Map<string, ViewerPin[]>();
  for (const p of pinRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = p as any;
    const vp: ViewerPin = {
      id: row.id,
      x: row.x,
      y: row.y,
      w: row.w ?? 0,
      h: row.h ?? 0,
      number: row.number,
      status: row.status,
      device: (row.device as "desktop" | "mobile") ?? "desktop",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: (row.comments ?? []).map((c: any) => ({
        id: c.id,
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
    };
    const arr = pinsByMockup.get(row.mockup_id) ?? [];
    arr.push(vp);
    pinsByMockup.set(row.mockup_id, arr);
  }

  // Newest version first, only versions that actually have comments.
  const commentGroups: CompareCommentGroup[] = [...list]
    .reverse()
    .map((m) => ({
      key: m.id,
      label: m.version ? `Version ${m.version}` : m.name,
      pins: pinsByMockup.get(m.id) ?? [],
    }))
    .filter((g) => g.pins.some((p) => p.comments.length > 0));

  return (
    <CompareView
      mockups={list}
      initialLeft={initialLeft}
      initialRight={initialRight}
      projectId={projectId}
      projectName={project.name}
      commentGroups={commentGroups}
    />
  );
}

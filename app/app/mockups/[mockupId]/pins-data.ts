import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLocalPart } from "@/lib/format";
import { sanitizeCommentHtml } from "@/lib/sanitize";
import type { ViewerPin } from "@/components/viewer/MockupViewer";

// Building a ViewerPin is more than reshaping rows: comment bodies are
// sanitized, author names are resolved through a join, and every attachment
// needs a freshly signed Storage URL. None of that can be reconstructed in the
// browser from a realtime payload, which carries raw columns and no joins.
//
// So this lives in one place, used by the page on first render and by
// refreshPins when realtime reports a change. Two copies of this mapping would
// drift, and the way they would drift is that live updates quietly stop
// sanitizing or lose their attachments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadViewerPins(supabase: SupabaseClient<any>, mockupId: string): Promise<ViewerPin[]> {
  const { data: pins } = await supabase
    .from("pins")
    .select(
      "id, x, y, w, h, number, status, device, comments(id, body, author_id, parent_comment_id, created_at, edited_at, profiles(name, email), comment_attachments(file_path, type, name))",
    )
    .eq("mockup_id", mockupId)
    .order("number", { ascending: true });

  /* Supabase's untyped client infers nested one-to-many joins loosely (profiles
     comes back as an array, attachments as unknown[]), so these row shapes are
     `any` by necessity rather than by choice. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const attachmentPaths = (pins ?? []).flatMap((p: any) =>
    (p.comments ?? []).flatMap((c: any) => (c.comment_attachments ?? []).map((a: any) => a.file_path as string)),
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: urls } = await supabase.storage.from("comment-files").createSignedUrls(attachmentPaths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signedAttachmentUrls.set(u.path, u.signedUrl);
  }

  return (pins ?? []).map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    w: p.w ?? 0,
    h: p.h ?? 0,
    number: p.number,
    status: p.status,
    device: (p.device as "desktop" | "mobile") ?? "desktop",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    comments: (p.comments ?? []).map((c: any) => ({
      id: c.id,
      // Sanitize at render time too: the comments table is directly writable via
      // RLS by any project member, so a raw body could bypass addComment's
      // write-time sanitize. Idempotent with it, and covers legacy or
      // directly-inserted rows.
      body: sanitizeCommentHtml((c.body as string) ?? ""),
      authorId: c.author_id ?? null,
      parentCommentId: c.parent_comment_id,
      createdAt: c.created_at,
      editedAt: c.edited_at ?? null,
      authorName: c.profiles?.name || emailLocalPart(c.profiles?.email ?? "") || "Unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: (c.comment_attachments ?? []).map((a: any) => ({
        url: signedAttachmentUrls.get(a.file_path) ?? "",
        type: a.type,
        name: a.name,
      })),
    })),
  }));
}

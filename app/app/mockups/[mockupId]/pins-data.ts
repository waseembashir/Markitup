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
  // Feedback belongs to the FILE, across every version of it — a new upload
  // used to open with an empty rail, which reads as the client's comments
  // having been thrown away. Load the whole version group and tag each pin
  // with the version it was left on.
  //
  // Their pins are deliberately NOT drawn on a different version's canvas. A
  // pin is a coordinate on one particular layout; a v1 pin over a redesigned v2
  // points at whatever now occupies that spot, which is the same wrongness that
  // put desktop pins on mobile layouts. The viewer draws the current version's
  // pins and lists the rest.
  const { data: self } = await supabase
    .from("mockups")
    .select("version_group, project_id")
    .eq("id", mockupId)
    .maybeSingle();
  const group = (self as { version_group?: string } | null)?.version_group;

  const { data: siblings } = group
    ? await supabase
        .from("mockups")
        .select("id, version")
        .eq("version_group", group)
        .order("version", { ascending: true })
    : { data: null };

  const versionOf = new Map<string, number>(
    ((siblings ?? []) as { id: string; version: number }[]).map((m) => [m.id, m.version]),
  );
  // Fall back to this file alone if the group lookup found nothing.
  const ids = versionOf.size ? [...versionOf.keys()] : [mockupId];

  const { data: pins } = await supabase
    .from("pins")
    .select(
      "id, mockup_id, created_by, x, y, w, h, number, status, device, comments(id, body, author_id, parent_comment_id, created_at, edited_at, profiles(name, email), comment_attachments(file_path, type, name))",
    )
    .in("mockup_id", ids)
    .order("number", { ascending: true });

  /* Supabase's untyped client infers nested one-to-many joins loosely (profiles
     comes back as an array, attachments as unknown[]), so these row shapes are
     `any` by necessity rather than by choice. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const attachmentPaths = (pins ?? []).flatMap((p: any) =>
    (p.comments ?? []).flatMap((c: any) => (c.comment_attachments ?? []).map((a: any) => a.file_path as string)),
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Author names come through comment_author_names rather than the profiles
  // join, which a client cannot read for the agency team — every team comment
  // showed as "Unknown" to them. The function returns a display name only,
  // never an email, and only for comments the caller can already see.
  const pinIds = (pins ?? []).map((p) => p.id as string);
  const authorName = new Map<string, string>();
  if (pinIds.length) {
    const { data: names } = await supabase.rpc("comment_author_names", { p_pins: pinIds });
    for (const n of (names ?? []) as { id: string; name: string }[]) if (n.name) authorName.set(n.id, n.name);
  }

  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: urls } = await supabase.storage.from("comment-files").createSignedUrls(attachmentPaths, 3600);
    for (const u of urls ?? []) if (u.signedUrl && u.path) signedAttachmentUrls.set(u.path, u.signedUrl);
  }

  return (pins ?? []).map((p) => ({
    id: p.id,
    mockupId: p.mockup_id as string,
    createdBy: (p.created_by as string) ?? null,
    // Which version this feedback was left on, and whether that is the one on
    // screen. Only the current version's pins are drawn on the canvas.
    version: versionOf.get(p.mockup_id as string) ?? 1,
    isCurrentVersion: (p.mockup_id as string) === mockupId,
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
      authorName:
        authorName.get(c.author_id) ||
        // Fallbacks for a comment whose author the function did not return,
        // such as one whose profile has since been deleted.
        c.profiles?.name ||
        emailLocalPart(c.profiles?.email ?? "") ||
        "Unknown",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attachments: (c.comment_attachments ?? []).map((a: any) => ({
        url: signedAttachmentUrls.get(a.file_path) ?? "",
        type: a.type,
        name: a.name,
      })),
    })),
  }));
}

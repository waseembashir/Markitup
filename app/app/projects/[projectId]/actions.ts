"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { reportIssue } from "@/lib/observability";
import { ACCEPTED_IMAGE_TYPES, HTML_MIME } from "@/lib/validation";

function extForType(type: string) {
  if (type === HTML_MIME) return "html";
  return type === "image/png" ? "png" : "jpg";
}

function typeForPath(path: string): "image" | "html" {
  return /\.html?$/i.test(path) ? "html" : "image";
}

export type Device = "desktop" | "mobile";

// Which views a client is offered. Anything that is not a known view is
// dropped, and an empty choice falls back to both — a file must be reviewable
// in at least one view, and the database refuses an empty list anyway.
function cleanDevices(devices?: readonly string[] | null): Device[] {
  const known = (devices ?? []).filter((d): d is Device => d === "desktop" || d === "mobile");
  const unique = [...new Set(known)];
  return unique.length ? unique : ["desktop", "mobile"];
}

// Step 1 of the upload. The browser sends only the file *type* here; the action
// returns a short-lived signed upload URL so the file *bytes* can go straight
// from the browser to Supabase Storage. This bypasses the Server Action request
// body — Vercel caps function request bodies at 4.5MB regardless of
// `serverActions.bodySizeLimit`, which would otherwise reject large mockups.
//
// Creating the signed URL uses the caller's session, so the storage "write
// mockup objects" RLS policy (can_see_project) is enforced here: a non-member
// cannot obtain a token for a project's folder.
export async function createMockupUploadUrl(projectId: string, fileType: string) {
  const isImage = ACCEPTED_IMAGE_TYPES.includes(fileType as (typeof ACCEPTED_IMAGE_TYPES)[number]);
  if (!isImage && fileType !== HTML_MIME) {
    return { error: "Only PNG, JPG or HTML files are supported." };
  }

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  const path = `${projectId}/${crypto.randomUUID()}.${extForType(fileType)}`;
  const { data, error } = await supabase.storage
    .from("mockups")
    .createSignedUploadUrl(path);
  if (error) return { error: error.message };

  return { path: data.path, token: data.token };
}

// Step 2 of the upload. After the browser finishes the direct upload, record
// the mockup row. Only a reference (the storage path) crosses the wire, never
// the bytes. The `mockups` INSERT RLS policy re-checks project membership.
export async function finalizeMockup(
  projectId: string,
  path: string,
  name: string,
  folderId?: string | null,
  devices?: readonly string[],
) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  // The object must live under this project's folder. Without this, a caller
  // could point a project's row at a file uploaded to a different folder.
  if (!path.startsWith(`${projectId}/`)) {
    return { error: "Invalid upload path." };
  }

  const { error: insErr } = await supabase.from("mockups").insert({
    project_id: projectId,
    name,
    type: typeForPath(path),
    file_path: path,
    created_by: userData.user.id,
    folder_id: folderId ?? null,
    devices: cleanDevices(devices),
  });
  if (insErr) return { error: insErr.message };

  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

// Add a new version of an existing file. Each version is its own mockups row
// sharing the base's version_group, so its pins/comments stay separate.
export async function addMockupVersion(baseMockupId: string, path: string) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  const { data: base } = await supabase
    .from("mockups")
    .select("project_id, name, version_group, devices")
    .eq("id", baseMockupId)
    .maybeSingle();
  if (!base) return { error: "Original file not found." };

  // The object must live under this project's folder.
  if (!path.startsWith(`${base.project_id}/`)) {
    return { error: "Invalid upload path." };
  }

  // Next version number within the group.
  const { data: peers } = await supabase
    .from("mockups")
    .select("version")
    .eq("version_group", base.version_group)
    .order("version", { ascending: false })
    .limit(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nextVersion = ((peers?.[0] as any)?.version ?? 0) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from("mockups")
    .insert({
      project_id: base.project_id,
      name: base.name,
      type: typeForPath(path),
      file_path: path,
      created_by: userData.user.id,
      version: nextVersion,
      version_group: base.version_group,
      devices: cleanDevices(base.devices as string[] | null),
    })
    .select("id")
    .maybeSingle();
  if (insErr) return { error: insErr.message };

  revalidatePath(`/app/projects/${base.project_id}`);
  return { id: inserted?.id as string | undefined, version: nextVersion };
}

// Swap the file behind an EXISTING version, rather than stacking a new one on
// top. For the case where the wrong file went up, or a version needs correcting
// without turning a two-round review into a three-round one.
//
// The row keeps its id, so its pins, comments and place in the version history
// all survive — which is the point. That also means the pins keep coordinates
// measured against the file being replaced: fine for a corrected export of the
// same design, wrong if the layout actually moved, in which case a new version
// is the honest thing to upload.
export async function replaceMockupFile(mockupId: string, path: string) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in to upload." };

  const { data: target } = await supabase
    .from("mockups")
    .select("project_id, file_path")
    .eq("id", mockupId)
    .maybeSingle();
  if (!target) return { error: "File not found." };

  // The object must live under this project's folder.
  if (!path.startsWith(`${target.project_id}/`)) {
    return { error: "Invalid upload path." };
  }

  const oldPath = target.file_path as string;

  // RLS decides whether this person may change the file; a reviewer's update
  // matches no rows rather than erroring.
  const { data: updated, error } = await supabase
    .from("mockups")
    .update({ file_path: path, type: typeForPath(path) })
    .eq("id", mockupId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "Only the workspace team can replace a file." };

  // Storage is the tightest quota this product has, so do not leave the old
  // object behind — but only when nothing else points at it. Versions created
  // by copying a row share a path, and deleting it would blank the other one.
  if (oldPath && oldPath !== path) {
    const { data: others } = await supabase
      .from("mockups")
      .select("id")
      .eq("file_path", oldPath)
      .limit(1);
    if (!others?.length) {
      const { error: rmErr } = await supabase.storage.from("mockups").remove([oldPath]);
      // A failed cleanup is wasted bytes, not a failed replace.
      if (rmErr) reportIssue("Could not delete the replaced file from Storage", { oldPath, reason: rmErr.message });
    }
  }

  revalidatePath(`/app/projects/${target.project_id}`);
  revalidatePath(`/app/mockups/${mockupId}`);
  return { id: mockupId };
}

// Delete one version of a file, for an upload that should never have happened.
//
// This is a real delete, not an archive: the row goes, and its pins and
// comments go with it. The caller is told how much feedback that is before
// confirming, because it cannot be undone.
export async function deleteMockupVersion(mockupId: string) {
  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "You must be signed in." };

  const { data: target } = await supabase
    .from("mockups")
    .select("project_id, version_group, file_path")
    .eq("id", mockupId)
    .maybeSingle();
  if (!target) return { error: "File not found." };

  const { data: siblings } = await supabase
    .from("mockups")
    .select("id, version")
    .eq("version_group", target.version_group)
    .order("version", { ascending: false });

  const others = (siblings ?? []).filter((m) => m.id !== mockupId);
  // The last version IS the file. Removing it here would leave the project
  // pointing at nothing; deleting the file itself is a separate, clearer act.
  if (!others.length) {
    return { error: "This is the only version. Delete the file itself instead." };
  }

  // share_links cascades from mockups, so deleting the version that happens to
  // hold the link would take the link with it — and that URL is already sitting
  // in a client's inbox. Move it to a surviving version first.
  const { data: link } = await supabase
    .from("share_links")
    .select("token")
    .eq("mockup_id", mockupId)
    .maybeSingle();
  if (link) {
    const { error: moveErr } = await supabase
      .from("share_links")
      .update({ mockup_id: others[0].id })
      .eq("mockup_id", mockupId);
    // Losing the client's link is worse than failing to delete a version.
    if (moveErr) return { error: "Could not move the share link off this version, so it was not deleted." };
  }

  const oldPath = target.file_path as string;

  const { data: deleted, error } = await supabase
    .from("mockups")
    .delete()
    .eq("id", mockupId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  // RLS turns "not allowed" into zero rows rather than an error.
  if (!deleted) return { error: "Only the workspace team can delete a version." };

  // Free the bytes, unless another row still points at the same object.
  if (oldPath) {
    const { data: stillUsed } = await supabase
      .from("mockups")
      .select("id")
      .eq("file_path", oldPath)
      .limit(1);
    if (!stillUsed?.length) {
      const { error: rmErr } = await supabase.storage.from("mockups").remove([oldPath]);
      if (rmErr) reportIssue("Could not delete a removed version's file from Storage", { oldPath, reason: rmErr.message });
    }
  }

  revalidatePath(`/app/projects/${target.project_id}`);
  // Where to send someone who was looking at the version that just went.
  return { survivorId: others[0].id as string };
}

// Change which views clients are offered. Applied to every version of the
// file, because a client moving between versions should not find a mobile
// view appearing and disappearing under them.
export async function setMockupDevices(mockupId: string, devices: readonly string[]) {
  const chosen = cleanDevices(devices);
  const supabase = await createServerSupabase();

  const { data: self } = await supabase
    .from("mockups")
    .select("project_id, version_group")
    .eq("id", mockupId)
    .maybeSingle();
  if (!self) return { error: "File not found." };

  const { data: updated, error } = await supabase
    .from("mockups")
    .update({ devices: chosen })
    .eq("version_group", self.version_group)
    .select("id");
  if (error) return { error: error.message };
  // RLS turns "not allowed" into zero rows rather than an error.
  if (!updated?.length) return { error: "Only the workspace team can change this." };

  revalidatePath(`/app/mockups/${mockupId}`);
  return { devices: chosen };
}

export async function getMockupSignedUrl(filePath: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.storage
    .from("mockups")
    .createSignedUrl(filePath, 60 * 60);
  return data?.signedUrl ?? null;
}

// Hide a single file from its project (restorable from the Archive page).
export async function archiveMockup(mockupId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mockups")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", mockupId)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/app/projects/${data.project_id}`);
  revalidatePath("/app/archive");
  return {};
}

export async function unarchiveMockup(mockupId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mockups")
    .update({ archived_at: null })
    .eq("id", mockupId)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/app/projects/${data.project_id}`);
  revalidatePath("/app/archive");
  return {};
}

export async function renameMockup(mockupId: string, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Enter a name" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("mockups")
    .update({ name: clean.slice(0, 120) })
    .eq("id", mockupId)
    .select("project_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.project_id) revalidatePath(`/app/projects/${data.project_id}`);
  return {};
}

export async function deleteMockup(mockupId: string) {
  const supabase = await createServerSupabase();

  // Grab the path + project before deleting so we can clean storage + revalidate.
  const { data: mockup } = await supabase
    .from("mockups")
    .select("file_path, project_id")
    .eq("id", mockupId)
    .maybeSingle();

  // Cascades handle pins, comments, attachments, share links, notifications, views.
  const { error } = await supabase.from("mockups").delete().eq("id", mockupId);
  if (error) return { error: error.message };

  // Best-effort storage cleanup (non-fatal).
  if (mockup?.file_path) {
    await supabase.storage.from("mockups").remove([mockup.file_path]);
  }
  if (mockup?.project_id) revalidatePath(`/app/projects/${mockup.project_id}`);
  revalidatePath("/app/archive");
  return {};
}

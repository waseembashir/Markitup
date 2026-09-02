"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export async function archiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath("/app/archive");
  return {};
}

export async function unarchiveProject(projectId: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath("/app/archive");
  return {};
}

export async function renameProject(projectId: string, name: string) {
  const clean = name.trim();
  if (!clean) return { error: "Enter a project name" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("projects").update({ name: clean.slice(0, 100) }).eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

export async function deleteProject(projectId: string) {
  const supabase = await createServerSupabase();

  // Best-effort: remove the project's storage originals first (the DB rows
  // cascade, but storage objects don't). Failure here is non-fatal.
  const { data: files } = await supabase.storage.from("mockups").list(projectId);
  if (files?.length) {
    await supabase.storage.from("mockups").remove(files.map((f) => `${projectId}/${f.name}`));
  }

  // Cascades handle mockups, pins, comments, attachments, share links,
  // notifications and views.
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/projects");
  revalidatePath("/app/archive");
  return {};
}

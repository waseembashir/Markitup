"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { parseFigmaUrl, buildEmbedUrl, figmaRenderPng, figmaNodeName } from "@/lib/figma";
import { getCurrentWorkspace } from "./actions";
import { thumbPathFor, forgetSigned } from "@/lib/thumbs";

export async function getFigmaConnection(): Promise<{ connected: boolean }> {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { connected: false };
  const { data } = await supabase
    .from("workspace_integrations")
    .select("figma_token_cipher")
    .eq("workspace_id", ws.id)
    .maybeSingle();
  return { connected: !!data?.figma_token_cipher };
}

export async function setFigmaToken(token: string) {
  const clean = token.trim();
  if (!clean) return { error: "Paste a Figma personal access token." };
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { data: userData } = await supabase.auth.getUser();

  let cipher: string, iv: string;
  try {
    ({ cipher, iv } = encryptSecret(clean));
  } catch {
    return { error: "Server is missing FIGMA_TOKEN_SECRET." };
  }

  const { error } = await supabase.from("workspace_integrations").upsert(
    {
      workspace_id: ws.id,
      figma_token_cipher: cipher,
      figma_token_iv: iv,
      connected_by: userData.user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id" },
  );
  if (error) {
    return {
      error: /row-level|policy/i.test(error.message)
        ? "Only workspace owners or admins can connect Figma."
        : error.message,
    };
  }
  revalidatePath("/app/settings");
  return {};
}

export async function disconnectFigma() {
  const supabase = await createServerSupabase();
  const ws = await getCurrentWorkspace();
  if (!ws) return { error: "No workspace" };
  const { error } = await supabase
    .from("workspace_integrations")
    .update({ figma_token_cipher: null, figma_token_iv: null })
    .eq("workspace_id", ws.id);
  if (error) return { error: error.message };
  revalidatePath("/app/settings");
  return {};
}

async function workspaceFigmaToken(supabase: SupabaseClient, workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_integrations")
    .select("figma_token_cipher, figma_token_iv")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!data?.figma_token_cipher || !data?.figma_token_iv) return null;
  try {
    return decryptSecret(data.figma_token_cipher, data.figma_token_iv);
  } catch {
    return null;
  }
}

async function renderToStorage(
  supabase: SupabaseClient,
  ref: { fileKey: string; nodeId: string },
  token: string,
  path: string,
  upsert: boolean,
): Promise<{ error?: string }> {
  const rendered = await figmaRenderPng(ref, token);
  if ("error" in rendered) return { error: rendered.error };
  let bytes: ArrayBuffer;
  try {
    const r = await fetch(rendered.url);
    bytes = await r.arrayBuffer();
  } catch {
    return { error: "Could not download the rendered frame from Figma." };
  }
  const { error } = await supabase.storage
    .from("mockups")
    .upload(path, Buffer.from(bytes), { contentType: "image/png", upsert });
  if (error) return { error: error.message };
  // A re-sync overwrites the file in place, so its preview now shows the old
  // frame. Drop it; the next teammate to see the card makes a fresh one.
  if (upsert) {
    await supabase.storage.from("mockups").remove([thumbPathFor(path)]);
    forgetSigned(thumbPathFor(path));
  }
  return {};
}

export async function importFigmaFrame(projectId: string, figmaUrl: string, folderId?: string | null) {
  const ref = parseFigmaUrl(figmaUrl);
  if (!ref) return { error: "That doesn't look like a Figma link." };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const { data: proj } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!proj) return { error: "Project not found" };

  const token = await workspaceFigmaToken(supabase, proj.workspace_id);
  if (!token) return { error: "Connect Figma in workspace settings first." };

  const name = (await figmaNodeName(ref, token)) || "Figma frame";
  const path = `${projectId}/${crypto.randomUUID()}.png`;
  const res = await renderToStorage(supabase, ref, token, path, false);
  if (res.error) return { error: res.error };

  const { error: insErr } = await supabase.from("mockups").insert({
    project_id: projectId,
    name,
    type: "figma",
    file_path: path,
    created_by: userData.user!.id,
    folder_id: folderId ?? null,
    figma_file_key: ref.fileKey,
    figma_node_id: ref.nodeId,
    figma_embed_url: buildEmbedUrl(ref.fileKey, ref.nodeId),
  });
  if (insErr) return { error: insErr.message };

  revalidatePath(`/app/projects/${projectId}`);
  return {};
}

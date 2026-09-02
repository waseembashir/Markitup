"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload, HTML_MIME } from "@/lib/validation";
import { injectHeightReporter } from "@/lib/html-embed";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { createMockupUploadUrl, addMockupVersion } from "@/app/app/projects/[projectId]/actions";

// Shared client flow for uploading a new version of an existing file: signed
// URL → direct upload → record the version row. Surfaces a live progress toast
// that morphs into success/error.
export function useVersionUpload({
  baseMockupId,
  projectId,
  navigateToNew = false,
}: {
  baseMockupId: string;
  projectId: string;
  navigateToNew?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  function upload(file: File) {
    // `name` matters: browsers routinely report an empty MIME type for .html, so
    // without it the extension fallback can't fire and an HTML version is
    // rejected as an unsupported file.
    const check = validateUpload({ size: file.size, type: file.type, name: file.name });
    if (!check.ok) {
      setError(check.error);
      toast.error(check.error);
      return;
    }
    const isHtml = check.kind === "html";
    setError(null);
    const id = toast.push({ title: "Uploading new version…", variant: "loading", progress: 0.06 });
    let p = 0.06;

    start(async () => {
      const iv = setInterval(() => {
        p = p < 0.92 ? p + (0.92 - p) * 0.14 : p;
        toast.update(id, { progress: p });
      }, 160);
      const failToast = (message: string) => {
        clearInterval(iv);
        setError(message);
        toast.update(id, { variant: "error", title: "Upload failed", description: message, progress: undefined, duration: 4000 });
      };
      try {
        // Normalize the type the same way the first-upload path does — the
        // server only accepts an exact MIME, and .html often arrives as "".
        const uploadType = isHtml ? HTML_MIME : file.type;
        const target = await createMockupUploadUrl(projectId, uploadType);
        if ("error" in target && target.error) return failToast(target.error);

        // HTML needs the height-reporter injected before it goes up, or the
        // viewer can't size the sandboxed frame and pins lose their anchor.
        const body: Blob = isHtml
          ? new Blob([injectHeightReporter(await file.text())], { type: HTML_MIME })
          : file;
        const supabase = createBrowserSupabase();
        const { error: upErr } = await supabase.storage
          .from("mockups")
          .uploadToSignedUrl(target.path!, target.token!, body, { contentType: uploadType });
        if (upErr) return failToast(upErr.message);

        const res = await addMockupVersion(baseMockupId, target.path!);
        clearInterval(iv);
        if (res.error) return failToast(res.error);

        toast.update(id, { variant: "success", title: "New version uploaded", description: undefined, progress: 1, duration: 2500 });
        if (navigateToNew && res.id) router.push(`/app/mockups/${res.id}`);
        else router.refresh();
      } catch {
        failToast("Upload failed. Please try again.");
      }
    });
  }

  return { pending, error, upload };
}

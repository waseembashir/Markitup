"use client";

import { useRef, useState } from "react";
import { createAttachmentUploadUrl } from "@/app/app/mockups/[mockupId]/attachment-actions";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";
import { Avatar } from "@/components/app/AppSidebar";

export type PendingAttachment = { path: string; type: "image" | "pdf"; name: string };

const ACCEPTED_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "application/pdf"];

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // preserve the editor selection: don't let the button steal focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
    >
      {children}
    </button>
  );
}

export function RichCommentInput({
  onSubmit,
  pending,
  placeholder,
  projectId,
  author,
}: {
  value?: string;
  onSubmit: (html: string, attachments: PendingAttachment[]) => void;
  pending?: boolean;
  placeholder?: string;
  projectId: string;
  // Shown at the top-left of the box so it's obvious who is about to speak.
  author?: { name: string; email: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empty, setEmpty] = useState(true);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    // execCommand is deprecated but universally supported; adequate for a
    // small comment formatter and avoids a heavy editor dependency.
    // jsdom (used in tests) does not implement execCommand, so guard it.
    if (typeof document.execCommand === "function") document.execCommand(cmd, false, arg);
    syncEmpty();
  }

  function syncEmpty() {
    const html = ref.current?.innerHTML ?? "";
    setEmpty(html.replace(/<br>|\s|&nbsp;/g, "").length === 0);
  }

  async function uploadFile(file: File) {
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
      setUploadError("Only PNG, JPG, and PDF attachments are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File exceeds the 25 MB limit.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      // 1. Ask the server for a signed upload URL (tiny request).
      const target = await createAttachmentUploadUrl(projectId, file.type);
      if ("error" in target && target.error) {
        setUploadError(target.error);
        return;
      }

      // 2. Send the bytes straight to Supabase Storage, bypassing the Server
      // Action body limit so files up to 25 MB upload from anywhere.
      const supabase = createBrowserSupabase();
      const { error: upErr } = await supabase.storage
        .from("comment-files")
        .uploadToSignedUrl(target.path!, target.token!, file, {
          contentType: file.type,
        });
      if (upErr) {
        setUploadError(upErr.message);
        return;
      }

      setAttachments((a) => [
        ...a,
        { path: target.path!, type: file.type === "application/pdf" ? "pdf" : "image", name: file.name },
      ]);
    } catch {
      setUploadError("Could not upload the file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(path: string) {
    setAttachments((a) => a.filter((x) => x.path !== path));
  }

  function insertPlainText(text: string) {
    if (typeof document.execCommand === "function") {
      document.execCommand("insertText", false, text);
      return;
    }
    // jsdom (tests) has no execCommand; fall back to manual DOM insertion so
    // pasted text still lands as text, never as parsed HTML.
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      el.appendChild(document.createTextNode(text));
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // SECURITY: block the browser's native (unsanitized) paste on EVERY path,
    // including when clipboardData is missing — call preventDefault first.
    e.preventDefault();
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    // Image/PDF files pasted from the clipboard become attachments, not
    // inline HTML.
    const items = Array.from(clipboardData.items ?? []);
    const fileItem = items.find((i) => i.kind === "file" && ACCEPTED_ATTACHMENT_TYPES.includes(i.type));
    if (fileItem) {
      const file = fileItem.getAsFile();
      if (file) uploadFile(file);
      return;
    }

    // SECURITY: never let pasted HTML land in the editor DOM (e.g.
    // `<img onerror=...>`). Always insert the plain-text form only.
    const text = clipboardData.getData("text/plain");
    if (text) insertPlainText(text);
    syncEmpty();
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    // SECURITY: block the browser's native drop (which would insert dragged
    // HTML into the contentEditable) on EVERY path.
    e.preventDefault();
    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;

    // Dropped image/PDF files become attachments via the same upload path.
    const files = Array.from(dataTransfer.files ?? []);
    const file = files.find((f) => ACCEPTED_ATTACHMENT_TYPES.includes(f.type));
    if (file) {
      uploadFile(file);
      return;
    }

    // Anything else: insert only the plain-text form, never dropped HTML.
    const text = dataTransfer.getData("text/plain");
    if (text) insertPlainText(text);
    syncEmpty();
  }

  function submit() {
    const html = ref.current?.innerHTML ?? "";
    if (empty && attachments.length === 0) return;
    onSubmit(html, attachments);
    if (ref.current) ref.current.innerHTML = "";
    setEmpty(true);
    setAttachments([]);
  }

  return (
    <div className="rounded-lg border bg-surface">
      {author && (
        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
          <Avatar name={author.name} email={author.email} size={26} />
          <span className="truncate text-sm font-semibold text-ink">{author.name}</span>
        </div>
      )}
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        <ToolBtn label="Bold" onClick={() => exec("bold")}><span className="text-sm font-bold">B</span></ToolBtn>
        <ToolBtn label="Italic" onClick={() => exec("italic")}><span className="text-sm italic">I</span></ToolBtn>
        <ToolBtn label="Underline" onClick={() => exec("underline")}><span className="text-sm underline">U</span></ToolBtn>
        <ToolBtn label="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="4" cy="6" r="1.3" fill="currentColor" /><circle cx="4" cy="12" r="1.3" fill="currentColor" /><circle cx="4" cy="18" r="1.3" fill="currentColor" /></svg>
        </ToolBtn>
        <ToolBtn label="Link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 14a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>
        <ToolBtn label="Attach file" onClick={() => fileInputRef.current?.click()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 12.5V7a4 4 0 1 1 8 0v8a2.5 2.5 0 1 1-5 0V8.5a1 1 0 1 1 2 0V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = "";
        }}
      />
      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3.5 top-3 text-sm text-faint">{placeholder}</span>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-label="Comment"
          contentEditable
          suppressContentEditableWarning
          onInput={syncEmpty}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
          data-project={projectId}
          /* focus-visible:shadow-none opts out of the global lime focus ring in
             globals.css — on a large writing surface it reads as a stray
             outline, and the caret already shows focus here. */
          className="max-h-64 min-h-[6.5rem] w-full overflow-y-auto px-3.5 py-3 text-sm leading-relaxed text-ink outline-none focus-visible:shadow-none [&_a]:text-brand-ink [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t px-2 py-2">
          {attachments.map((a) => (
            <span
              key={a.path}
              className="inline-flex max-w-[10rem] items-center gap-1 rounded-md border bg-surface-2 px-2 py-1 text-xs text-ink"
            >
              <span className="truncate">{a.name}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name}`}
                onClick={() => removeAttachment(a.path)}
                className="shrink-0 text-muted hover:text-danger"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {uploadError && (
        <p className="px-2 pt-1 text-xs font-medium" style={{ color: "var(--color-danger)" }}>
          {uploadError}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t px-2 py-2">
        <span className="text-xs text-faint">{uploading ? "Uploading…" : ""}</span>
        <button
          type="button"
          disabled={pending || uploading || (empty && attachments.length === 0)}
          onClick={submit}
          className="btn-primary btn-sm"
        >
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </div>
  );
}

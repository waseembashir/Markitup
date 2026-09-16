"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVersionUpload } from "./useVersionUpload";
import { deleteMockupVersion } from "@/app/app/projects/[projectId]/actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/toast";

export type VersionItem = {
  id: string;
  version: number;
  createdAt: string;
  // How much feedback deleting this version would destroy. Shown in the
  // confirmation, because the delete cannot be undone.
  commentCount?: number;
};

export function VersionSwitcher({
  versions,
  currentId,
  projectId,
  canUpload = true,
}: {
  versions: VersionItem[]; // sorted newest (highest version) first
  currentId: string;
  projectId: string;
  // Uploading a version belongs to the owning team; offering it to a reviewer or
  // guest would only produce a button RLS then refuses.
  canUpload?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Which version the next picked file should replace. Null means add a new
  // version on top, which is what this input did before.
  const [replacing, setReplacing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The version awaiting a delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState<VersionItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function doDelete(v: VersionItem) {
    setDeleting(true);
    const res = await deleteMockupVersion(v.id);
    setDeleting(false);
    setConfirmDelete(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Version ${v.version} deleted`);
    // Leaving someone on a version that no longer exists would 404 them.
    if (v.id === currentId && res.survivorId) router.push(`/app/mockups/${res.survivorId}`);
    else router.refresh();
  }
  const { pending, error, upload } = useVersionUpload({
    baseMockupId: currentId,
    projectId,
    navigateToNew: true,
  });

  const current = versions.find((v) => v.id === currentId);
  const latest = versions[0];
  const prev = versions[1];
  const compareHref =
    latest && prev
      ? `/app/projects/${projectId}/compare?left=${prev.id}&right=${latest.id}`
      : null;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,text/html,.html,.htm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file, replacing ?? undefined);
          setReplacing(null);
          // Let the same file be picked again after a mistake.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="btn-secondary btn-sm gap-2"
        title="Versions"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="m4 12 8 3.5L20 12M4 16.5 12 20l8-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        {pending ? "Uploading…" : `Version ${current?.version ?? 1}`}
        {versions.length > 1 && (
          <span className="rounded-full bg-brand-soft px-2 text-[0.625rem] font-bold text-brand-ink">{versions.length}</span>
        )}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-1 w-60 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg">
            <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">Versions</p>
            <div className="max-h-64 overflow-y-auto">
              {versions.map((v) => (
                <div key={v.id} className="group flex items-center rounded-md transition-colors hover:bg-[color:var(--accent)]">
                  <Link
                    href={`/app/mockups/${v.id}`}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-sm"
                    style={v.id === currentId ? { color: "var(--color-ink)", fontWeight: 700 } : { color: "var(--foreground)" }}
                  >
                    <span className="truncate">Version {v.version}{v.id === latest?.id ? " · Latest" : ""}</span>
                    {v.id === currentId && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                  </Link>
                  {canUpload && (
                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        title={`Replace the file for version ${v.version}, keeping its comments`}
                        onClick={() => { setReplacing(v.id); setOpen(false); inputRef.current?.click(); }}
                        className="rounded px-2 py-1 text-xs font-semibold text-muted hover:text-brand-ink"
                      >
                        Replace
                      </button>
                      {versions.length > 1 && (
                        <button
                          type="button"
                          title={`Delete version ${v.version} and its comments`}
                          onClick={() => { setConfirmDelete(v); setOpen(false); }}
                          className="mr-1 rounded px-2 py-1 text-xs font-semibold text-muted hover:text-danger"
                        >
                          Delete
                        </button>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {canUpload && (
            <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => { setOpen(false); inputRef.current?.click(); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[color:var(--accent)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 16V5m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Upload new version
            </button>
            </>
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={confirmDelete ? `Delete version ${confirmDelete.version}?` : ""}
        message={
          confirmDelete?.commentCount
            ? `Its ${confirmDelete.commentCount === 1 ? "1 comment" : `${confirmDelete.commentCount} comments`} will be deleted too. This cannot be undone.`
            : "This cannot be undone."
        }
        confirmLabel="Delete version"
        pending={deleting}
        pendingLabel="Deleting…"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && doDelete(confirmDelete)}
      />
      {error && (
        <span className="absolute left-0 top-full mt-1 whitespace-nowrap text-xs font-medium" style={{ color: "var(--color-danger)" }}>{error}</span>
      )}
      </div>
      {compareHref && (
        <Link href={compareHref} className="btn-secondary btn-sm gap-2" title="Compare previous vs latest — hold Space to flip">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            <rect x="13" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Compare
        </Link>
      )}
    </div>
  );
}

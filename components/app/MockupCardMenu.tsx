"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveMockup, deleteMockup, renameMockup } from "@/app/app/projects/[projectId]/actions";
import { ShareDialog } from "@/components/viewer/ShareDialog";
import { useVersionUpload } from "@/components/viewer/useVersionUpload";
import { CardMenu, MenuItem, ShareIcon, ArchiveIcon, TrashIcon, PencilIcon } from "@/components/app/CardMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RenameDialog } from "@/components/ui/RenameDialog";
import { MoveToFolderDialog, type FolderOption } from "@/components/app/MoveToFolderDialog";
import { useToast } from "@/components/ui/toast";

export function MockupCardMenu({
  mockupId,
  projectId,
  name,
  folders = [],
  currentFolderId = null,
}: {
  mockupId: string;
  projectId: string;
  name: string;
  folders?: FolderOption[];
  currentFolderId?: string | null;
}) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  function doArchive() {
    start(async () => {
      const res = (await archiveMockup(mockupId)) as { error?: string } | undefined;
      setArchiveOpen(false);
      if (res?.error) toast.error(res.error);
      else toast.success(`“${name}” archived`);
      router.refresh();
    });
  }

  function doRename(next: string) {
    start(async () => {
      const res = (await renameMockup(mockupId, next)) as { error?: string } | undefined;
      setRenameOpen(false);
      if (res?.error) toast.error(res.error);
      else toast.success("File renamed");
      router.refresh();
    });
  }
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending: uploading, upload } = useVersionUpload({ baseMockupId: mockupId, projectId });

  function confirmDelete() {
    start(async () => {
      const res = (await deleteMockup(mockupId)) as { error?: string } | undefined;
      setConfirm(false);
      if (res?.error) toast.error(res.error);
      else toast.success(`“${name}” deleted`, { description: "File and its comments removed." });
      router.refresh();
    });
  }

  const busy = pending || uploading;

  return (
    <>
      {/* Kept outside the dropdown so the file picker survives the menu closing. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,text/html,.html,.htm"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <CardMenu label="File options">
        {(close) => (
          <>
            <MenuItem onClick={() => { close(); setShareOpen(true); }}>
              <ShareIcon /> Share
            </MenuItem>
            <MenuItem disabled={busy} onClick={() => { close(); setRenameOpen(true); }}>
              <PencilIcon /> Rename
            </MenuItem>
            <MenuItem disabled={busy} onClick={() => { close(); inputRef.current?.click(); }}>
              <UploadIcon /> {uploading ? "Uploading…" : "Upload new version"}
            </MenuItem>
            {folders.length > 0 && (
              <MenuItem disabled={busy} onClick={() => { close(); setMoveOpen(true); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                Move to project
              </MenuItem>
            )}
            <MenuItem disabled={busy} onClick={() => { close(); setArchiveOpen(true); }}>
              <ArchiveIcon /> Archive
            </MenuItem>
            <MenuItem danger disabled={busy} onClick={() => { close(); setConfirm(true); }}>
              <TrashIcon /> Delete
            </MenuItem>
          </>
        )}
      </CardMenu>
      <ShareDialog mockupId={mockupId} hideTrigger open={shareOpen} onOpenChange={setShareOpen} />
      <MoveToFolderDialog
        open={moveOpen}
        mockupId={mockupId}
        mockupName={name}
        folders={folders}
        currentFolderId={currentFolderId}
        onClose={() => setMoveOpen(false)}
      />
      <RenameDialog open={renameOpen} label="Rename file" initial={name} pending={busy} onSave={doRename} onClose={() => setRenameOpen(false)} />
      <ConfirmDialog
        open={archiveOpen}
        variant="default"
        title="Archive this file?"
        message={<>Archiving <b className="text-ink">“{name}”</b> hides it from the project. You can restore it anytime from the Archive.</>}
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        pending={busy}
        onConfirm={doArchive}
        onCancel={() => setArchiveOpen(false)}
      />
      <ConfirmDialog
        open={confirm}
        title="Delete this file?"
        message={<>This permanently deletes <b className="text-ink">“{name}”</b> — all its versions, pins and comments. This action cannot be undone.</>}
        confirmLabel="Delete file"
        pendingLabel="Deleting…"
        pending={busy}
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 16V5m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

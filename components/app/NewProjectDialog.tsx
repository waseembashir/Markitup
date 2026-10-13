"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/app/actions";
import { useToast } from "@/components/ui/toast";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function NewProjectDialog({
  variant = "primary",
  workspaceId,
  workspaceName,
}: {
  variant?: "primary" | "secondary";
  /** Create it here instead of in the workspace the app opens. */
  workspaceId?: string;
  workspaceName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const fd = new FormData();
      fd.set("name", name.trim());
      if (workspaceId) fd.set("workspace_id", workspaceId);
      const res = (await createProject(fd)) as { error?: string } | undefined;
      if (res?.error) { toast.error(res.error); return; }
      setName("");
      setOpen(false);
      toast.success("Project created");
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={variant === "primary" ? "btn-primary btn-sm gap-2" : "btn-secondary btn-sm gap-2"}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        New project
      </button>

      {open && (
        <ModalPortal>
        <div className="fixed inset-0 z-[300] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="New project">
          <div className="fade-anim absolute inset-0 bg-black/30" onClick={() => !pending && setOpen(false)} />
          <form onSubmit={submit} className="pop-anim relative z-10 w-full max-w-sm rounded-2xl border bg-surface-2 p-5 shadow-lg">
            <h2 className="text-base font-bold text-ink">New project</h2>
            <p className="mt-1 text-xs text-muted">
              {workspaceName ? <>In <span className="font-semibold text-ink">{workspaceName}</span>. </> : null}
              Give your project a name — you can add files and projects next.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website redesign"
              className="field mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="btn-secondary btn-sm">Cancel</button>
              <button type="submit" disabled={pending || !name.trim()} className="btn-primary btn-sm">{pending ? "Creating…" : "Create project"}</button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useVersionUpload } from "./useVersionUpload";

export type VersionItem = { id: string; version: number; createdAt: string };

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
  const inputRef = useRef<HTMLInputElement>(null);
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
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
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
                <Link
                  key={v.id}
                  href={`/app/mockups/${v.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-[color:var(--accent)]"
                  style={v.id === currentId ? { color: "var(--color-ink)", fontWeight: 700 } : { color: "var(--foreground)" }}
                >
                  <span>Version {v.version}{v.id === latest?.id ? " · Latest" : ""}</span>
                  {v.id === currentId && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </Link>
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

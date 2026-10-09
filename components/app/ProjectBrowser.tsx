"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { FolderCard } from "@/components/app/FolderCard";
import { MockupCardMenu } from "@/components/app/MockupCardMenu";
import { UploadDropzone } from "@/components/viewer/UploadDropzone";
import { FigmaImport } from "@/components/viewer/FigmaImport";
import { HtmlThumbnail } from "@/components/viewer/HtmlThumbnail";
import { ThumbImage } from "@/components/app/ThumbImage";
import type { FolderOption } from "@/components/app/MoveToFolderDialog";

type Folder = { id: string; name: string };
export type FileItem = {
  id: string;
  name: string;
  url: string | null;
  /** Small preview for the card; absent until one has been made. */
  thumbUrl?: string;
  /** Set only for someone who may store files here, so a missing preview gets made. */
  filePath?: string;
  version: number;
  count: number;
  isNew: boolean;
  createdAt: string;
  type?: string;
};

const TABS = [
  { key: "all", label: "All" },
  { key: "folders", label: "Projects" },
  { key: "markups", label: "Files" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function ProjectBrowser({
  projectId,
  currentFolderId,
  folders,
  files,
  allFolders,
}: {
  projectId: string;
  currentFolderId: string | null;
  folders: Folder[];
  files: FileItem[];
  allFolders: FolderOption[];
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const query = q.trim().toLowerCase();

  const shownFolders = useMemo(() => folders.filter((f) => !query || f.name.toLowerCase().includes(query)), [folders, query]);
  const shownFiles = useMemo(() => files.filter((f) => !query || f.name.toLowerCase().includes(query)), [files, query]);

  const showFolders = tab !== "markups";
  const showFiles = tab !== "folders";
  const nothing = (!showFolders || shownFolders.length === 0) && (!showFiles || shownFiles.length === 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-surface p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="rounded px-3 py-1 text-xs font-semibold transition-colors"
              style={tab === t.key ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <svg className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this project…" className="field h-9 w-56 pl-8" />
        </div>
      </div>

      {/* Add files — always open, no popup. Drop an image (left) or paste a Figma link (right). */}
      {!query && (
        <div className="mb-6 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
          <UploadDropzone projectId={projectId} folderId={currentFolderId} />
          <FigmaImport projectId={projectId} folderId={currentFolderId} />
        </div>
      )}

      {nothing ? (
        query ? (
          <div className="rise-in card grid place-items-center px-6 py-14 text-center text-sm text-faint">
            Nothing matches your search.
          </div>
        ) : null
      ) : (
        <div className="space-y-6">
          {showFolders && shownFolders.length > 0 && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shownFolders.map((f) => (
                <li key={f.id}>
                  <FolderCard id={f.id} name={f.name} href={`/app/projects/${projectId}?folder=${f.id}`} />
                </li>
              ))}
            </ul>
          )}
          {showFiles && shownFiles.length > 0 && (
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {shownFiles.map((m) => (
                <li key={m.id} className="relative">
                  <div className="absolute top-2 right-2 z-10">
                    <MockupCardMenu mockupId={m.id} projectId={projectId} name={m.name} folders={allFolders} currentFolderId={currentFolderId} />
                  </div>
                  <Link href={`/app/mockups/${m.id}`} className="card card-hover block overflow-hidden">
                    <div className="relative aspect-[4/3] w-full overflow-hidden border-b bg-canvas">
                      {m.isNew && (
                        <span className="absolute top-2 left-2 z-10 rounded-full px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-[color:var(--primary-foreground)] uppercase" style={{ background: "var(--color-brand)" }}>
                          New
                        </span>
                      )}
                      {m.type === "html" && m.url ? (
                        <>
                          <HtmlThumbnail url={m.url} className="h-full w-full" />
                          <span className="absolute bottom-1.5 left-1.5 z-10 rounded px-2 py-0.5 text-[0.5625rem] font-bold tracking-wider text-white uppercase" style={{ background: "color-mix(in srgb, var(--color-ink) 72%, transparent)" }}>
                            HTML
                          </span>
                        </>
                      ) : m.url ? (
                        <ThumbImage url={m.url} thumbUrl={m.thumbUrl} filePath={m.filePath} className="media-in h-full w-full object-cover object-top" />
                      ) : (
                        <div className="h-full w-full bg-brand-soft" />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="truncate text-sm font-semibold text-ink">{m.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
                        {m.count > 1 && (
                          <span className="rounded bg-brand-soft px-2 py-0.5 text-[0.625rem] font-bold text-brand-ink">V{m.version}</span>
                        )}
                        <span className="font-mono">{timeAgo(m.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

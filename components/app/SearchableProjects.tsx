"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { SearchField } from "@/components/app/SearchField";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";
import { searchTerms, matchesSearch } from "@/lib/search";
import type { ProjectItem } from "@/app/app/dashboard-data";
import type { MyWorkspace } from "@/app/app/actions";

type Group = { workspace: MyWorkspace; items: ProjectItem[] };

const TAB_KEY = "projects.workspace";

/**
 * The Projects page: a tab per workspace, the team's first. New project sits
 * in the tab row and creates in the tab on screen, so where a project lands is
 * never a guess. One search box narrows every tab; each tab says how many match.
 */
export function SearchableProjects({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState(groups[0]?.workspace.id ?? "");
  const terms = searchTerms(query);

  // The tab you used last, if it's still one of yours. Read after mount: the
  // server can't see this browser's choice.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && groups.some((g) => g.workspace.id === saved)) setTab(saved);
    } catch {
      // storage unavailable: the team's tab
    }
  }, [groups]);

  function pick(id: string) {
    setTab(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      // storage unavailable: lasts this visit only
    }
  }

  const filtered = useMemo(
    () => groups.map((g) => ({ ...g, items: g.items.filter((p) => matchesSearch(terms, p.name, p.files)) })),
    // terms is a fresh array each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query],
  );
  const current = filtered.find((g) => g.workspace.id === tab) ?? filtered[0];
  if (!current) return null;
  const ws = current.workspace;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div role="tablist" aria-label="Workspaces" className="flex flex-wrap items-center gap-1">
          {filtered.map((g) => {
            const active = g.workspace.id === ws.id;
            return (
              <button
                key={g.workspace.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => pick(g.workspace.id)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
                style={
                  active
                    ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                    : { color: "var(--muted-foreground)" }
                }
              >
                <span>{g.workspace.name}</span>
                <span
                  className="rounded-full px-1.5 text-xs tabular-nums"
                  style={{ background: active ? "color-mix(in oklch, var(--primary-foreground) 14%, transparent)" : "var(--accent)" }}
                >
                  {g.items.length}
                </span>
                {!g.workspace.primary && g.workspace.ownedByMe && <span className="text-xs font-medium opacity-75">Personal</span>}
              </button>
            );
          })}
        </div>
        <NewProjectDialog workspaceId={ws.id} workspaceName={ws.name} />
      </div>

      <SearchField value={query} onChange={setQuery} placeholder="Search projects and files" className="mb-6 w-full max-w-xs" />

      {current.items.length > 0 ? (
        <ProjectGrid items={current.items} />
      ) : terms.length > 0 ? (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">Nothing in {ws.name} matches “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted">Searching project names and the files inside them. Other tabs show their own matches.</p>
        </div>
      ) : (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <h3 className="text-lg font-semibold">No projects in {ws.name} yet</h3>
          <p className="mt-1 mb-4 max-w-sm text-sm text-muted">Create one, upload a file, and start collecting pinned feedback.</p>
          <NewProjectDialog workspaceId={ws.id} workspaceName={ws.name} />
        </div>
      )}
    </>
  );
}

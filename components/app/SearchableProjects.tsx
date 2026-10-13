"use client";

import { useMemo, useState } from "react";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { SearchField } from "@/components/app/SearchField";
import { NewProjectDialog } from "@/components/app/NewProjectDialog";
import { WorkspaceHeading } from "@/components/app/WorkspaceHeading";
import { searchTerms, matchesSearch } from "@/lib/search";
import { plural } from "@/lib/format";
import type { ProjectItem } from "@/app/app/dashboard-data";
import type { MyWorkspace } from "@/app/app/actions";

type Group = { workspace: MyWorkspace; items: ProjectItem[] };

/** The Projects page: each workspace's grid, with one box above that narrows them all. */
export function SearchableProjects({ groups }: { groups: Group[] }) {
  const [query, setQuery] = useState("");
  const terms = searchTerms(query);
  const shown = useMemo(
    () => groups.map((g) => ({ ...g, items: g.items.filter((p) => matchesSearch(terms, p.name, p.files)) })),
    // terms is a fresh array each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, query],
  );
  const matchCount = shown.reduce((n, g) => n + g.items.length, 0);
  // One workspace needs no headings; more than one, each is labelled.
  const labelled = groups.length > 1;

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SearchField value={query} onChange={setQuery} placeholder="Search projects and files" className="w-full max-w-xs" />
        {terms.length > 0 && (
          <p className="shrink-0 text-xs text-muted">{matchCount === 0 ? "No matches" : plural(matchCount, "project")}</p>
        )}
      </div>

      {terms.length > 0 && matchCount === 0 ? (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">Nothing matches “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted">Searching project names and the files inside them.</p>
        </div>
      ) : (
        shown.map(({ workspace: ws, items }) =>
          // While searching, a workspace with nothing matching steps aside.
          terms.length > 0 && items.length === 0 ? null : (
            <section key={ws.id} className="mb-10">
              {labelled && (
                <WorkspaceHeading
                  ws={ws}
                  count={items.length}
                  action={!ws.primary ? <NewProjectDialog variant="secondary" workspaceId={ws.id} workspaceName={ws.name} /> : undefined}
                />
              )}
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted">No projects here yet.</p>
              ) : (
                <ProjectGrid items={items} />
              )}
            </section>
          ),
        )
      )}
    </>
  );
}

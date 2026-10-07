"use client";

import { useMemo, useState } from "react";
import { ProjectGrid } from "@/components/app/ProjectGrid";
import { SearchField } from "@/components/app/SearchField";
import { searchTerms, matchesSearch } from "@/lib/search";
import { plural } from "@/lib/format";
import type { ProjectItem } from "@/app/app/dashboard-data";

/** The Projects page's grid, with a box above it that narrows it down. */
export function SearchableProjects({ items }: { items: ProjectItem[] }) {
  const [query, setQuery] = useState("");
  const terms = searchTerms(query);
  const matches = useMemo(
    () => items.filter((p) => matchesSearch(terms, p.name, p.files)),
    // terms is a fresh array each render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, query],
  );

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search projects and files"
          className="w-full max-w-xs"
        />
        {terms.length > 0 && (
          <p className="shrink-0 text-xs text-muted">
            {matches.length === 0 ? "No matches" : `${plural(matches.length, "project")}`}
          </p>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="text-sm font-semibold text-ink">Nothing matches “{query.trim()}”</p>
          <p className="mt-1 text-sm text-muted">Searching project names and the files inside them.</p>
        </div>
      ) : (
        <ProjectGrid items={matches} />
      )}
    </>
  );
}

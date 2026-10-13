"use client";

import { useEffect, useId, useState } from "react";

// A section that folds away behind a full-width header. Closed by default; the
// choice is remembered per browser under `storageKey`, best-effort (private
// windows and blocked storage just get the default). `summary` stays visible
// while it's closed, so folding it never hides something that needs attention.
export function Collapsible({
  title,
  summary,
  storageKey,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  storageKey: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Read after mount: the server can't see this browser's choice, and reading
  // it during render would disagree with the server's markup.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(storageKey) === "open") setOpen(true);
    } catch {
      // storage unavailable: stay closed
    }
  }, [storageKey]);

  function toggle() {
    setOpen((v) => {
      try {
        localStorage.setItem(storageKey, v ? "closed" : "open");
      } catch {
        // storage unavailable: the choice lasts this visit only
      }
      return !v;
    });
  }

  return (
    <section className="card overflow-hidden p-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[color:var(--accent)]"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink">{title}</span>
          {summary}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="shrink-0 text-muted transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div id={panelId} className="border-t px-5 pt-4 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}

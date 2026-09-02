"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

export function AppChrome({
  workspaceName,
  children,
}: {
  workspaceName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const path = pathname ?? "";
  // Immersive routes hide the app nav (revealable): the mockup viewer and the
  // compare screen (whose left rail is the comments panel instead).
  const isViewer = path.startsWith("/app/mockups/") || path.endsWith("/compare");
  const [reveal, setReveal] = useState(false);
  // Collapse the revealed nav on navigation. Adjusted during render rather than
  // in an effect — React's documented way to reset state when a prop changes,
  // and it avoids rendering the old route's reveal state for a frame.
  const [revealPath, setRevealPath] = useState(pathname);
  if (revealPath !== pathname) {
    setRevealPath(pathname);
    setReveal(false);
  }
  const showSidebar = !isViewer || reveal;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {showSidebar && <AppSidebar workspaceName={workspaceName} />}
      <div className="relative flex-1 overflow-y-auto">
        {isViewer && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide sidebar" : "Show sidebar menu"}
            className="absolute bottom-4 left-4 z-50 grid h-9 w-9 place-items-center rounded-full border bg-surface text-muted shadow-lg transition-colors hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

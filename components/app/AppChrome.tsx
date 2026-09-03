"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "./AppSidebar";

export function AppChrome({
  workspaceName,
  isGuest = false,
  children,
}: {
  workspaceName: string;
  // A guest on a public link has no workspace to navigate — they get the file
  // they were sent and nothing else.
  isGuest?: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "";
  // Immersive routes drop the app nav: the mockup viewer and the compare screen,
  // whose left rail is the comments panel instead. There used to be a floating
  // hamburger here to bring the nav back over the design — it sat on top of the
  // artwork and read as part of it. The viewer's own back arrow is the way out.
  const isViewer = path.startsWith("/app/mockups/") || path.endsWith("/compare");
  const showSidebar = !isViewer && !isGuest;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {showSidebar && <AppSidebar workspaceName={workspaceName} />}
      <div className="relative flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

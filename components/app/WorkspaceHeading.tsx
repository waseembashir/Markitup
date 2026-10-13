import { plural } from "@/lib/format";
import type { MyWorkspace } from "@/app/app/actions";

/** A workspace's heading: its name, what kind it is, and how much is in it. */
export function WorkspaceHeading({ ws, count, action }: { ws: MyWorkspace; count: number; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className={ws.primary ? "text-lg font-bold tracking-tight text-ink" : "text-sm font-bold text-ink"}>{ws.name}</h2>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-ink">
          {ws.primary ? "Team workspace" : ws.ownedByMe ? "Personal" : "Shared with you"}
        </span>
        <span className="text-sm text-muted">· {plural(count, "project")}</span>
      </div>
      {action}
    </div>
  );
}

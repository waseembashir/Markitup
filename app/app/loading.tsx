import { Skeleton, SkeletonProjectCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <SkeletonPageHeader />

      {/* Needs attention: a row of small action cards */}
      <Skeleton className="mb-3 h-4 w-32 rounded" />
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>

      {/* "Where each project stands", compact: five rows */}
      <Skeleton className="mb-4 h-4 w-40 rounded" />
      <Skeleton className="mb-8 h-[17rem] w-full rounded-xl" />

      {/* the team workspace, set apart, with its projects */}
      <div className="mb-8 rounded-2xl border bg-surface p-6">
        <Skeleton className="mb-5 h-5 w-64 rounded" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

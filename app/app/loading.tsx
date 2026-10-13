import { Skeleton, SkeletonProjectCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <SkeletonPageHeader />

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

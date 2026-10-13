import { Skeleton, SkeletonProjectCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <SkeletonPageHeader />

      {/* the team workspace, set apart, with its projects */}
      <div className="mb-8 rounded-2xl border p-6">
        <Skeleton className="mb-5 h-5 w-64 rounded" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </div>
      </div>

      {/* "Where each project stands", folded */}
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}

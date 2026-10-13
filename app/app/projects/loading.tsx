import { Skeleton, SkeletonProjectCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function ProjectsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <SkeletonPageHeader />
      {/* workspace tabs and New project */}
      <div className="mb-5 flex items-center justify-between border-b pb-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <Skeleton className="mb-6 h-9 w-72 rounded-md" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonProjectCard key={i} />
        ))}
      </div>
    </div>
  );
}

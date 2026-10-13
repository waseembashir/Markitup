// Shimmering placeholder blocks used by route-level loading skeletons.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonProjectCard() {
  return (
    <div>
      {/* folder tab */}
      <div className="h-4 w-[40%] rounded-t-[8px]" style={{ background: "var(--secondary)" }} />
      {/* folder body wraps the whole card */}
      <div className="rounded-[8px] rounded-tl-none p-4" style={{ background: "var(--secondary)" }}>
        <Skeleton className="aspect-[16/10] w-full rounded-[6px]" />
        <div className="space-y-3 px-0.5 pt-4">
          <Skeleton className="h-4 w-2/3 rounded" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-9 rounded" />
            <Skeleton className="h-3 w-9 rounded" />
            <Skeleton className="h-3 w-9 rounded" />
          </div>
          <div className="flex items-center gap-2 border-t pt-4">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonPageHeader({ actions = 3 }: { actions?: number }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 rounded" />
        <Skeleton className="h-3 w-56 rounded" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className={i === 0 ? "h-9 w-28 rounded-md" : "h-9 w-9 rounded-full"} />
        ))}
      </div>
    </div>
  );
}

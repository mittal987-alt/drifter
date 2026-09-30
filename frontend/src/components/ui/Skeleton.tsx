interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-4 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-3 w-24" />
      <Skeleton className="mt-2 h-8 w-16" />
    </div>
  );
}

export function SkeletonRow({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-4 flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="flex items-end gap-2 h-48">
        {[60, 80, 45, 90, 55, 75, 65, 85, 70, 50, 88, 72].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-md"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonMap() {
  return (
    <div className="h-[400px] rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <SkeletonStat />
      <SkeletonMap />
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <SkeletonChart />
        <SkeletonRow lines={7} />
      </div>
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-6 py-2 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-secondary/60 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-20 bg-secondary/60 rounded" />
          <div className="h-2 w-12 bg-secondary/40 rounded" />
        </div>
        <div className="h-4 w-3/4 bg-secondary/50 rounded" />
      </div>
    </div>
  );
}

export function MessageSkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3 py-6">
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton key={i} />
      ))}
    </div>
  );
}

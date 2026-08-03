import { Skeleton } from "@/components/ui/Skeleton";

export function VersionHistoryLoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
      <div className="space-y-4 lg:col-span-1">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

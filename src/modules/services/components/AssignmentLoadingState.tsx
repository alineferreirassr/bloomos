import { Skeleton } from "@/components/ui/Skeleton";

export function AssignmentLoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2 lg:col-span-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

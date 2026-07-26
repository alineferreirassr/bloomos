import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the real shape (header row, tab strip, two-column Overview) so the loading state doesn't jump/reflow once real data lands. */
export function ServiceDetailLoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-3 border-b border-border pb-4">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

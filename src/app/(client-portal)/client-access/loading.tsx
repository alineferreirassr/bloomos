import { Skeleton } from "@/components/ui/Skeleton";

/** Checkpoint 19, Step 13 — the Client Dashboard's own route-level loading skeleton. Only applies to `/client-access` itself (its sibling pages keep their own existing loading behavior). */
export default function ClientAccessLoading() {
  return (
    <div className="min-h-screen bg-luxury-background p-4 sm:p-6 md:p-8">
      <div className="space-y-6">
        <Skeleton className="h-14 w-2/3" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

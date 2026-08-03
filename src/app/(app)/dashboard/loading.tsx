import { Skeleton } from "@/components/ui/Skeleton";

/** Checkpoint 19, Step 13 — the Owner/Team Luxury Dashboard's own route-level loading skeleton, the idiomatic Next.js App Router convention (shown automatically while `page.tsx`'s async data resolves), rather than a client-side loading flag. */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-luxury-background p-4 sm:p-6 md:p-8">
      <div className="space-y-6">
        <Skeleton className="h-14 w-2/3" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

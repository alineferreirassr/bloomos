"use client";

import { useEffect, useState } from "react";
import { getTimelineByVendorId } from "@/lib/data";
import type { TimelineActivity } from "@/types/timelineActivity";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Timeline } from "@/modules/timeline/components/Timeline";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; activities: TimelineActivity[] };

async function loadVendorTimeline(vendorId: string): Promise<LoadState> {
  try {
    const activities = await getTimelineByVendorId(vendorId);
    return { status: "ready", activities };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of the rest of VendorDetailView (its own effect, own
 * loading/error state) so a Timeline failure never blanks the Vendor's main
 * details — unlike ClientDetailView's single combined Promise.all, which
 * would fail the whole page if any one of its parallel fetches throws.
 */
export function VendorTimelineSection({ vendorId }: { vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadVendorTimeline(vendorId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const retry = () => {
    setState({ status: "loading" });
    loadVendorTimeline(vendorId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-live="polite" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this vendor's activity history." onRetry={retry} />;
  }

  return (
    <Timeline
      activities={state.activities}
      emptyTitle="No activity yet"
      emptyDescription="Actions taken on this vendor — created, updated, archived, restored, or marked preferred — will show up here."
    />
  );
}

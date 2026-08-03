"use client";

import { useEffect, useState } from "react";
import { getTimelineByPurchaseId } from "@/lib/data";
import type { TimelineActivity } from "@/types/timelineActivity";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Timeline } from "@/modules/timeline/components/Timeline";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; activities: TimelineActivity[] };

async function loadPurchaseTimeline(purchaseId: string): Promise<LoadState> {
  try {
    const activities = await getTimelineByPurchaseId(purchaseId);
    return { status: "ready", activities };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of the rest of PurchaseDetailView (own effect, own
 * loading/error state), same rationale as InventoryTimelineSection.
 */
export function PurchaseTimelineSection({ purchaseId }: { purchaseId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPurchaseTimeline(purchaseId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  const retry = () => {
    setState({ status: "loading" });
    loadPurchaseTimeline(purchaseId).then(setState);
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
    return <ErrorState message="Could not load this purchase's activity history." onRetry={retry} />;
  }

  return (
    <Timeline
      activities={state.activities}
      emptyTitle="No activity yet"
      emptyDescription="Actions taken on this purchase — created, updated, submitted, cancelled, archived, restored, or a line item received — will show up here."
    />
  );
}

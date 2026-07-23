"use client";

import { useEffect, useState } from "react";
import { getTimelineByInventoryItemId } from "@/lib/data";
import type { TimelineActivity } from "@/types/timelineActivity";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Timeline } from "@/modules/timeline/components/Timeline";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; activities: TimelineActivity[] };

async function loadInventoryItemTimeline(inventoryItemId: string): Promise<LoadState> {
  try {
    const activities = await getTimelineByInventoryItemId(inventoryItemId);
    return { status: "ready", activities };
  } catch {
    return { status: "error" };
  }
}

/**
 * Fetches independently of the rest of InventoryItemDetailView (own effect,
 * own loading/error state), same rationale as VendorTimelineSection.
 */
export function InventoryTimelineSection({ inventoryItemId }: { inventoryItemId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadInventoryItemTimeline(inventoryItemId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId]);

  const retry = () => {
    setState({ status: "loading" });
    loadInventoryItemTimeline(inventoryItemId).then(setState);
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
    return <ErrorState message="Could not load this item's activity history." onRetry={retry} />;
  }

  return (
    <Timeline
      activities={state.activities}
      emptyTitle="No activity yet"
      emptyDescription="Actions taken on this item — created, updated, archived, restored, or a stock movement — will show up here."
    />
  );
}

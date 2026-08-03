"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { generateOperationsBrief, type OperationsBrief } from "@/modules/ai/copilot/assistants/operationsAssistant";

type LoadState = { status: "loading" } | { status: "ready"; brief: OperationsBrief } | { status: "error" };

/** v2 Checkpoint 21, Step 15 — Bloom AI Operations, surfaced as a small additive card on the Event Detail page. */
export function OperationsAssistantCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    generateOperationsBrief(eventId).then(
      (brief) => {
        if (!cancelled) setState({ status: "ready", brief });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // Informational-only card — a failed fetch just quietly disappears rather than showing an error banner over an otherwise-working Event page.
  if (state.status === "error") return null;

  const { brief } = state;

  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Bloom AI — Operations Brief</p>
      <p className="mt-2 text-sm text-text">{brief.operationalBrief}</p>
      <ul className="mt-3 space-y-1.5 text-xs text-text-muted">
        <li>
          <span className="font-medium text-text">Packing:</span> {brief.packingSuggestion}
        </li>
        <li>
          <span className="font-medium text-text">Timeline:</span> {brief.timelineImprovement}
        </li>
        <li>
          <span className="font-medium text-text">Vendors:</span> {brief.vendorRecommendation}
        </li>
        <li>
          <span className="font-medium text-text">Team:</span> {brief.teamRecommendation}
        </li>
      </ul>
    </Card>
  );
}

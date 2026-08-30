"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluateClientJourneyAction } from "@/modules/clientJourney/clientJourneyActions";
import { journeyRouteId } from "@/modules/clientJourney/journeyRoute";
import type { ClientJourney } from "@/types/clientJourney";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * v2.0 Checkpoint 32, Step 10 — the native Journey section on Client
 * Detail. Additive: does not touch the approved existing Client Detail
 * structure, just slots in as one more `<LuxuryCard>` alongside
 * `ClientEventsSummaryCard`/`ClientFinancialSummaryCard`. Every figure
 * comes from `evaluateClientJourneyAction` — this card never recomputes
 * anything on its own.
 */

const STATUS_TONE: Record<ClientJourney["status"], BadgeTone> = { active: "success", at_risk: "warning", blocked: "danger", completed: "accent", lost: "neutral", cancelled: "neutral" };

export function ClientJourneySummaryCard({ clientId }: { clientId: string }) {
  const [journey, setJourney] = useState<ClientJourney | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluateClientJourneyAction("client", clientId).then((result) => {
      if (cancelled) return;
      if (result.success) setJourney(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (error || !journey) return null;

  const topAction = journey.nextBestActions[0];

  return (
    <LuxuryCard>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Journey</h3>
        <Link href={`/client-journeys/${encodeURIComponent(journeyRouteId("client", clientId))}`} className="text-xs text-accent hover:underline">
          View full journey →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[journey.status]}>{journey.status.replace("_", " ")}</Badge>
        <Badge tone="neutral">{JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage]}</Badge>
        <Badge tone="outline">{journey.progress.overallPercentage}% complete</Badge>
        <Badge tone="outline">Health {journey.health.overallJourneyHealth}</Badge>
      </div>
      {journey.blockers.length > 0 && (
        <p className="mt-3 text-sm text-warning">
          {journey.blockers.length} blocker{journey.blockers.length === 1 ? "" : "s"}: {journey.blockers[0].description}
        </p>
      )}
      {topAction && (
        <p className="mt-2 text-sm text-text-muted">
          Next: <span className="text-text">{topAction.label}</span>
        </p>
      )}
    </LuxuryCard>
  );
}

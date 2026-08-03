"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluateClientJourneyAction } from "@/modules/clientJourney/clientJourneyActions";
import { journeyRouteId } from "@/modules/clientJourney/journeyRoute";
import type { ClientJourney } from "@/types/clientJourney";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * v2.0 Checkpoint 32, Step 11 — the native Journey section on Lead
 * Detail. Shows Current Journey Stage, Qualification Readiness (derived
 * from the same Requirements Engine every Journey uses), Blockers, and
 * Next Best Action. Convert-to-Client stays on `LeadActions` — this card
 * never duplicates that flow, only links to it via the existing page.
 */

const STATUS_TONE: Record<ClientJourney["status"], BadgeTone> = { active: "success", at_risk: "warning", blocked: "danger", completed: "accent", lost: "neutral", cancelled: "neutral" };

export function LeadJourneySummaryCard({ leadId }: { leadId: string }) {
  const [journey, setJourney] = useState<ClientJourney | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluateClientJourneyAction("lead", leadId).then((result) => {
      if (cancelled) return;
      if (result.success) setJourney(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (!journey) return null;

  const qualifiedRequirement = journey.requirements.length > 0;
  const topAction = journey.nextBestActions[0];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">Journey</h3>
        <Link href={`/client-journeys/${encodeURIComponent(journeyRouteId("lead", leadId))}`} className="text-xs text-accent hover:underline">
          View full journey →
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[journey.status]}>{journey.status.replace("_", " ")}</Badge>
        <Badge tone="neutral">{JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage]}</Badge>
        {qualifiedRequirement && <Badge tone={journey.requirements.every((r) => r.met) ? "success" : "warning"}>{journey.requirements.every((r) => r.met) ? "Qualification complete" : "Qualification incomplete"}</Badge>}
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
    </Card>
  );
}

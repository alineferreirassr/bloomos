"use client";

import { useEffect, useState } from "react";
import { getClientPortalJourneySummaryAction, type ClientPortalJourneySummary } from "@/modules/clientPortal/getClientPortalJourneySummary";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * v2.0 Checkpoint 32, Step 16 — Client Portal Journey Integration.
 * Self-fetching, additive card slotted into the existing approved Client
 * Dashboard structure — never touches `ClientDashboardData`'s own
 * server-side aggregation pipeline. Only ever renders the client-safe
 * `ClientPortalJourneySummary` projection (see
 * `getClientPortalJourneySummary.ts`'s own Privacy disclosure) — never
 * the internal `ClientJourney` object.
 */
export function ClientPortalJourneyCard() {
  const [summary, setSummary] = useState<ClientPortalJourneySummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClientPortalJourneySummaryAction().then((result) => {
      if (cancelled) return;
      if (result.success) setSummary(result.data);
      else setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;

  return (
    <LuxuryCard>
      <SectionHeader title="Your Journey" action={summary ? <span className="text-luxury-small text-luxury-text-muted">{summary.progressPercentage}% complete</span> : undefined} />
      {!summary ? (
        <p className="text-luxury-small text-luxury-text-muted">Loading…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-luxury-body text-luxury-text">
            Currently: <span className="font-medium">{summary.currentStageLabel}</span>
          </p>
          {summary.nextStepLabel && <p className="text-luxury-small text-luxury-text-muted">Next step: {summary.nextStepLabel}</p>}
          <div className="flex flex-wrap gap-2 text-luxury-small">
            {summary.pendingSignature && <span className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-rose">Signature pending</span>}
            {summary.pendingPayment && <span className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-rose">Payment pending</span>}
            {summary.pendingInformationRequests.length > 0 && <span className="rounded-full bg-luxury-rose/10 px-3 py-1 text-luxury-rose">{summary.pendingInformationRequests.length} information request(s) pending</span>}
          </div>
          {summary.completedMilestoneLabels.length === 0 ? (
            <EmptyState title="No milestones completed yet" description="Completed milestones will appear here as your planning progresses." />
          ) : (
            <ul role="list" className="text-luxury-small text-luxury-text-muted">
              {summary.completedMilestoneLabels.map((label) => (
                <li key={label} role="listitem">
                  ✓ {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </LuxuryCard>
  );
}

import type { JourneyAnalyticsSnapshot, JourneyStage } from "@/types/clientJourney";
import { JOURNEY_STAGES } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Analytics Engine (Step 20). A pure
 * aggregation over already-resolved per-journey facts the module layer
 * gathers (one `JourneyAnalyticsInput` per Lead/Client) — it never
 * queries Leads/Clients/Proposals itself and never duplicates the
 * Executive Analytics Platform (Checkpoint 15); the module layer exposes
 * this snapshot through that platform's own extension points instead of
 * a second dashboard for the same figures. Every rate defaults to `0`
 * (not a vacuous 100) when its denominator is `0` — "no data yet" is
 * honestly reported as `0%`, never dressed up as a perfect score.
 */

export interface JourneyAnalyticsInput {
  subjectType: "lead" | "client";
  currentStage: JourneyStage;
  createdAt: string;
  closedAt: string | null;
  isLead: boolean;
  convertedToClient: boolean;
  proposalSent: boolean;
  proposalAccepted: boolean;
  contractSent: boolean;
  contractSigned: boolean;
  depositRequired: boolean;
  depositPaid: boolean;
  isBlocked: boolean;
  lostOrCancelledAtStage: JourneyStage | null;
  followUpCompleted: boolean | null;
  reviewCompleted: boolean | null;
  rebookingCreated: boolean | null;
  stageEnteredAt: Partial<Record<JourneyStage, string>>;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 100);
}

function daysBetween(earlierIso: string, laterIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / (1000 * 60 * 60 * 24);
}

export function computeJourneyAnalytics(inputs: JourneyAnalyticsInput[], now: string): JourneyAnalyticsSnapshot {
  const leads = inputs.filter((i) => i.isLead);
  const withProposalSent = inputs.filter((i) => i.proposalSent);
  const withContractSent = inputs.filter((i) => i.contractSent);
  const withDepositRequired = inputs.filter((i) => i.depositRequired);
  const closed = inputs.filter((i) => i.closedAt !== null);

  const leadToClientConversionRate = rate(leads.filter((i) => i.convertedToClient).length, leads.length);
  const proposalAcceptanceRate = rate(withProposalSent.filter((i) => i.proposalAccepted).length, withProposalSent.length);
  const contractSignatureRate = rate(withContractSent.filter((i) => i.contractSigned).length, withContractSent.length);
  const depositCompletionRate = rate(withDepositRequired.filter((i) => i.depositPaid).length, withDepositRequired.length);
  const followUpCompletionRate = rate(closed.filter((i) => i.followUpCompleted === true).length, closed.length);
  const reviewCompletionRate = rate(closed.filter((i) => i.reviewCompleted === true).length, closed.length);
  const rebookingOpportunityRate = rate(closed.filter((i) => i.rebookingCreated === true).length, closed.length);
  const blockedJourneyCount = inputs.filter((i) => i.isBlocked).length;

  const durations = closed.map((i) => daysBetween(i.createdAt, i.closedAt as string));
  const averageJourneyDurationDays = durations.length === 0 ? 0 : Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 10) / 10;

  const averageTimePerStageDays: Partial<Record<JourneyStage, number>> = {};
  for (let idx = 0; idx < JOURNEY_STAGES.length - 1; idx += 1) {
    const stage = JOURNEY_STAGES[idx];
    const nextStage = JOURNEY_STAGES[idx + 1];
    const spans = inputs
      .map((i) => {
        const enter = i.stageEnteredAt[stage];
        const leave = i.stageEnteredAt[nextStage];
        return enter && leave ? daysBetween(enter, leave) : null;
      })
      .filter((v): v is number => v !== null && v >= 0);
    if (spans.length > 0) {
      averageTimePerStageDays[stage] = Math.round((spans.reduce((sum, d) => sum + d, 0) / spans.length) * 10) / 10;
    }
  }

  const dropOffCounts = new Map<JourneyStage, number>();
  for (const input of inputs) {
    if (input.lostOrCancelledAtStage) {
      dropOffCounts.set(input.lostOrCancelledAtStage, (dropOffCounts.get(input.lostOrCancelledAtStage) ?? 0) + 1);
    }
  }
  const dropOffPoints = [...dropOffCounts.entries()].map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count);

  return {
    leadToClientConversionRate,
    proposalAcceptanceRate,
    contractSignatureRate,
    depositCompletionRate,
    averageTimePerStageDays,
    dropOffPoints,
    blockedJourneyCount,
    averageJourneyDurationDays,
    followUpCompletionRate,
    reviewCompletionRate,
    rebookingOpportunityRate,
    evaluatedAt: now,
  };
}

import type { ProposalDraft } from "@/types/proposal";
import type { ProposalAnalyticsSnapshot, ProposalBuilderState } from "@/types/proposalPlatform";
import { currentVersionOf } from "@/core/proposalPlatform/proposalBuilderEngine";

/**
 * v2.0 Checkpoint 33 — Proposal Analytics (Step 13). Pure aggregation over
 * already-fetched `(ProposalDraft, ProposalBuilderState | null)` pairs — no
 * store access, no `Date.now()` (the caller injects `now`), matching every
 * other Analytics engine in this codebase (`journeyAnalyticsEngine.ts`,
 * Checkpoint 32).
 */

export interface ProposalAnalyticsInput {
  proposal: ProposalDraft;
  builderState: ProposalBuilderState | null;
}

function hoursBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60));
}

function incrementCount(map: Record<string, number>, key: string | null): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

export function computeProposalAnalytics(inputs: ProposalAnalyticsInput[], evaluatedAt: string): ProposalAnalyticsSnapshot {
  const totalProposals = inputs.length;

  let draftCount = 0;
  let publishedCount = 0;
  let sentCount = 0;
  let viewedCount = 0;
  let acceptedCount = 0;
  let declinedCount = 0;
  let archivedCount = 0;

  const proposalValues: number[] = [];
  const timeToAcceptHours: number[] = [];
  const revisionCounts: number[] = [];
  const discountPercents: number[] = [];
  const depositPercents: number[] = [];
  const templateUsage: Record<string, number> = {};
  const packageUsage: Record<string, number> = {};
  const addonUsage: Record<string, number> = {};

  for (const { proposal, builderState } of inputs) {
    if (proposal.status === "accepted") acceptedCount += 1;
    if (proposal.status === "rejected") declinedCount += 1;

    if (proposal.status === "accepted" && proposal.reviewed_at) {
      timeToAcceptHours.push(hoursBetween(proposal.generated_at, proposal.reviewed_at));
    }

    if (!builderState) continue;

    if (builderState.status === "draft") draftCount += 1;
    if (builderState.status === "published") publishedCount += 1;
    if (builderState.status === "archived") archivedCount += 1;
    if (builderState.sent_at) sentCount += 1;
    if (builderState.viewed_at) viewedCount += 1;

    revisionCounts.push(Math.max(0, builderState.versions.length - 1));

    const version = currentVersionOf(builderState);
    if (!version) continue;

    proposalValues.push(version.snapshot.pricing.grandTotal_minor);
    incrementCount(templateUsage, version.snapshot.templateKey);
    for (const id of version.snapshot.packageIds) incrementCount(packageUsage, id);
    for (const id of version.snapshot.addonIds) incrementCount(addonUsage, id);

    const { subtotal_minor, discountAmount_minor, grandTotal_minor, depositDue_minor } = version.snapshot.pricing;
    if (discountAmount_minor > 0 && subtotal_minor > 0) discountPercents.push((discountAmount_minor / subtotal_minor) * 100);
    if (grandTotal_minor > 0) depositPercents.push((depositDue_minor / grandTotal_minor) * 100);
  }

  const decidedCount = acceptedCount + declinedCount;
  const average = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);

  return {
    totalProposals,
    draftCount,
    publishedCount,
    sentCount,
    viewedCount,
    acceptedCount,
    declinedCount,
    archivedCount,
    acceptanceRate: decidedCount === 0 ? 0 : Math.round((acceptedCount / decidedCount) * 100),
    conversionRate: totalProposals === 0 ? 0 : Math.round((acceptedCount / totalProposals) * 100),
    averageProposalValue_minor: Math.round(average(proposalValues)),
    averageTimeToAcceptHours: timeToAcceptHours.length === 0 ? null : Math.round(average(timeToAcceptHours) * 10) / 10,
    averageRevisionCount: Math.round(average(revisionCounts) * 10) / 10,
    templateUsage,
    packageUsage,
    addonUsage,
    averageDiscountPercent: Math.round(average(discountPercents) * 10) / 10,
    averageDepositPercent: Math.round(average(depositPercents) * 10) / 10,
    evaluatedAt,
  };
}

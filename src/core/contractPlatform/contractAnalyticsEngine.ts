import type { Contract } from "@/types/contract";
import type { ContractAnalyticsSnapshot, ContractBuilderState } from "@/types/contractPlatform";
import { currentVersionOf } from "@/core/contractPlatform/contractBuilderEngine";

/**
 * v2.0 Checkpoint 34 — Contract Analytics (Step 11). Pure aggregation over
 * already-fetched `(Contract, ContractBuilderState | null)` pairs — no store
 * access, no `Date.now()` (the caller injects `evaluatedAt`), matching
 * `computeProposalAnalytics` (Checkpoint 33) exactly.
 *
 * Two metrics lean on proxies since no dedicated "left draft" event is
 * persisted: "Time In Draft" uses `hoursBetween(created_at, updated_at)` for
 * documents that have already moved past `"draft"` — `updated_at` is the
 * timestamp of the status transition itself, since `setStatus`/`appendVersion`
 * both bump it. "Time To Ready" uses the real `ready_at` (set once, the first
 * time Readiness reaches `"ready"` — see `ContractBuilderState.ready_at`).
 * Both are disclosed proxies over the closest real signal, not fabricated data.
 */

export interface ContractAnalyticsInput {
  contract: Contract;
  builderState: ContractBuilderState | null;
}

function hoursBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60));
}

function incrementCount(map: Record<string, number>, key: string | null): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

export function computeContractAnalytics(inputs: ContractAnalyticsInput[], evaluatedAt: string): ContractAnalyticsSnapshot {
  const totalContracts = inputs.length;

  let draftCount = 0;
  let reviewCount = 0;
  let publishedCount = 0;
  let archivedCount = 0;
  let documentsStarted = 0;
  let readyOrPublished = 0;

  const contractValues: number[] = [];
  const revisionCounts: number[] = [];
  const timeInDraftHours: number[] = [];
  const timeToReadyHours: number[] = [];
  const templateUsage: Record<string, number> = {};
  const clauseUsage: Record<string, number> = {};

  for (const { builderState } of inputs) {
    if (!builderState) continue;
    documentsStarted += 1;

    if (builderState.status === "draft") draftCount += 1;
    if (builderState.status === "review") reviewCount += 1;
    if (builderState.status === "published") publishedCount += 1;
    if (builderState.status === "archived") archivedCount += 1;
    if (builderState.status === "published" || builderState.ready_at) readyOrPublished += 1;

    revisionCounts.push(Math.max(0, builderState.versions.length - 1));

    if (builderState.status !== "draft") {
      timeInDraftHours.push(hoursBetween(builderState.created_at, builderState.updated_at));
    }
    if (builderState.ready_at) {
      timeToReadyHours.push(hoursBetween(builderState.created_at, builderState.ready_at));
    }

    const version = currentVersionOf(builderState);
    if (!version) continue;

    incrementCount(templateUsage, version.snapshot.builderTemplateKey);
    for (const clauseId of version.snapshot.clauseIds) incrementCount(clauseUsage, clauseId);
    if (version.snapshot.pricingReference?.grandTotal_minor != null) {
      contractValues.push(version.snapshot.pricingReference.grandTotal_minor);
    }
  }

  const average = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length);

  return {
    totalContracts,
    draftCount,
    reviewCount,
    publishedCount,
    archivedCount,
    averageContractValue_minor: Math.round(average(contractValues)),
    averageRevisionCount: Math.round(average(revisionCounts) * 10) / 10,
    templateUsage,
    clauseUsage,
    averageTimeInDraftHours: timeInDraftHours.length === 0 ? null : Math.round(average(timeInDraftHours) * 10) / 10,
    averageTimeToReadyHours: timeToReadyHours.length === 0 ? null : Math.round(average(timeToReadyHours) * 10) / 10,
    completionRate: documentsStarted === 0 ? 0 : Math.round((readyOrPublished / documentsStarted) * 100),
    evaluatedAt,
  };
}

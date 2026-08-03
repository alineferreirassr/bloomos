import type {
  DailyOperationsBriefContext,
  DailyOperationsBriefModelOutput,
  DailyOperationsBrief,
  DailyBriefResolvedRisk,
  DailyBriefResolvedSuggestedAction,
  DailyBriefEventSummary,
  DailyBriefComparison,
} from "@/modules/ai/dailyBrief/types";
import type { DetectedRisk } from "@/modules/ai/types";
import { computeDailyBriefConfidence, computeDailyBriefMissingInformation } from "@/modules/ai/dailyBrief/confidence";
import { resolveDailyBriefActionTarget } from "@/modules/ai/dailyBrief/actionTargets";
import { prepareCriticalFindings } from "@/modules/ai/dailyBrief/notifications";
import { computeIssueSnapshots } from "@/modules/ai/dailyBrief/contextBuilder";
import { clockNow } from "@/core/time/clock";

/**
 * Checkpoint 6, Step 7 — "highlight new issues, resolved issues, and
 * persistent risks," computed by diffing this run's own
 * `computeIssueSnapshots(context)` against whatever `context.previousSnapshot`
 * the optional `memory` Context Orchestrator section supplied. Entirely
 * deterministic, never the model's own claim of what changed — the same
 * "facts computed in code, the model only narrates" principle every other
 * Daily Brief section already follows. `null` when there's no prior
 * snapshot at all (this Workspace's very first Daily Brief).
 */
function computeBriefComparison(context: DailyOperationsBriefContext): DailyBriefComparison | null {
  const previous = context.previousSnapshot;
  if (!previous) return null;

  const current = computeIssueSnapshots(context);
  const previousKeys = new Set(previous.map((issue) => issue.key));
  const currentKeys = new Set(current.map((issue) => issue.key));

  return {
    newIssues: current.filter((issue) => !previousKeys.has(issue.key)).map((issue) => issue.label),
    resolvedIssues: previous.filter((issue) => !currentKeys.has(issue.key)).map((issue) => issue.label),
    persistentRisks: current.filter((issue) => previousKeys.has(issue.key)).map((issue) => issue.label),
  };
}

/**
 * Combines the validated model output (narrative sections) with
 * deterministic context (everything else) into the final, UI-ready brief.
 * `confidence`/`missingInformation` are computed here, entirely from
 * `context.unavailableCategories` — never from the model's own
 * self-reported confidence, same principle as Event Operations Brief.
 */
export function assembleDailyOperationsBrief(
  modelOutput: DailyOperationsBriefModelOutput,
  context: DailyOperationsBriefContext,
  workspaceId: string,
  recipientMemberId: string,
  now: Date = clockNow(),
): DailyOperationsBrief {
  const explanationByEventId = new Map(modelOutput.riskExplanations.map((entry) => [entry.eventId, entry.explanation]));

  function hasTopRisk(event: DailyBriefEventSummary): event is DailyBriefEventSummary & { topRisk: DetectedRisk } {
    return event.topRisk !== null;
  }

  const operationalRisks: DailyBriefResolvedRisk[] = context.eventsAtRisk.filter(hasTopRisk).map((event) => ({
    event,
    risk: event.topRisk,
    explanation: explanationByEventId.get(event.eventId) ?? null,
  }));

  const suggestedActions: DailyBriefResolvedSuggestedAction[] = modelOutput.suggestedActions.map((action) => ({
    label: action.label,
    reason: action.reason,
    actionTarget: resolveDailyBriefActionTarget(action.targetType, action.targetId),
  }));

  const brief: Omit<DailyOperationsBrief, "criticalFindings"> = {
    executiveSummary: modelOutput.executiveSummary,
    todaysPriorities: modelOutput.todaysPriorities,
    eventsToday: context.eventsToday,
    eventsThisWeek: context.eventsThisWeek,
    operationalRisks,
    latePayments: context.latePayments,
    contractIssues: context.unsignedContracts,
    checklistProgress: context.checklistProgress,
    teamAssignments: context.teamAssignments,
    recommendations: modelOutput.recommendations,
    suggestedActions,
    confidence: computeDailyBriefConfidence(context).score,
    missingInformation: computeDailyBriefMissingInformation(context),
    briefComparison: computeBriefComparison(context),
  };

  return { ...brief, criticalFindings: prepareCriticalFindings(context, workspaceId, recipientMemberId, now) };
}

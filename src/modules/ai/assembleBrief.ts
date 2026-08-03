import { resolveActionTarget } from "@/modules/ai/actionTargets";
import type { EventOperationsBriefContext, EventOperationsBrief, EventOperationsBriefModelOutput } from "@/modules/ai/types";

/**
 * The only place a Zod-validated model output is turned into what the UI
 * renders — this is where the *semantic* guardrails schema validation
 * alone can't express live: a risk `kind` the model invented (not present
 * in `context.detectedRisks`) is discarded, and every real detected risk is
 * shown regardless of whether the model addressed it (falling back to its
 * own deterministic `evidence` string) — a real, BloomOS-confirmed risk is
 * never silently hidden just because the model's response was incomplete.
 * `actionTargetType` never becomes a URL directly; `resolveActionTarget`
 * is the sole translator from the model's closed enum choice to a real
 * BloomOS route, so even a fully adversarial completion can only ever
 * point at one of three fixed, hardcoded destinations.
 */
export function assembleEventOperationsBrief(
  modelOutput: EventOperationsBriefModelOutput,
  context: EventOperationsBriefContext,
): EventOperationsBrief {
  const explanationByKind = new Map(modelOutput.riskExplanations.map((entry) => [entry.kind, entry.explanation]));

  const riskExplanations = context.detectedRisks.map((risk) => ({
    risk,
    explanation: explanationByKind.get(risk.kind) ?? risk.evidence,
  }));

  const recommendedActions = modelOutput.recommendedActions.map((action, index) => ({
    id: `action-${index}`,
    label: action.label,
    reason: action.reason,
    actionTarget: resolveActionTarget(action.actionTargetType, context.event.id),
  }));

  return {
    executiveSummary: modelOutput.executiveSummary,
    healthExplanation: modelOutput.healthExplanation,
    riskExplanations,
    recommendedActions,
    preparationNotes: modelOutput.preparationNotes,
    internalNotes: modelOutput.internalNotes,
  };
}

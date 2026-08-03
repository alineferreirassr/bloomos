import type { JourneyStage, JourneyRequirementResult, JourneyTransitionType } from "@/types/clientJourney";
import { JOURNEY_STAGES, OPTIONAL_JOURNEY_STAGES } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Transition Engine (Step 4). The current
 * stage for every non-terminal, non-post-closed journey is always
 * recomputed fresh by `journeyStateResolver.ts` from source-module facts —
 * this engine never overrides that. What it validates instead is every
 * *manual* action a team member can take on a journey (advance with an
 * explicit note, explicitly skip an optional stage, cancel, mark lost,
 * restore, or reopen an earlier stage) before it is ever written to
 * `JourneyTransitionRecord`, so "arbitrary stage mutation without
 * validation" (the spec's own explicit prohibition) is impossible.
 */

const STAGE_RANK: Record<JourneyStage, number> = Object.fromEntries(JOURNEY_STAGES.map((stage, index) => [stage, index])) as Record<JourneyStage, number>;
const OPTIONAL_SET = new Set(OPTIONAL_JOURNEY_STAGES);
const TERMINAL_SET = new Set<JourneyStage>(["closed", "lost", "cancelled"]);

export type TransitionRequestKind = "advance" | "skip_optional" | "cancel" | "lose" | "restore" | "reopen";

export interface TransitionRequest {
  kind: TransitionRequestKind;
  targetStage: JourneyStage;
}

export interface TransitionEvaluation {
  type: JourneyTransitionType;
  allowed: boolean;
  blockingRules: string[];
}

function stagesBetween(fromStage: JourneyStage, toStage: JourneyStage): JourneyStage[] {
  const fromRank = STAGE_RANK[fromStage];
  const toRank = STAGE_RANK[toStage];
  return JOURNEY_STAGES.filter((s) => STAGE_RANK[s] > fromRank && STAGE_RANK[s] < toRank);
}

/** Pure — takes the current resolved stage, the requested manual action, and (for `advance`) the already-evaluated requirements for the target stage from the Requirements Engine. Never re-derives requirement facts itself. */
export function evaluateTransitionRequest(currentStage: JourneyStage, request: TransitionRequest, requirementsForTarget: JourneyRequirementResult[] = []): TransitionEvaluation {
  switch (request.kind) {
    case "advance": {
      if (STAGE_RANK[request.targetStage] <= STAGE_RANK[currentStage]) {
        return { type: "blocked", allowed: false, blockingRules: [`'${request.targetStage}' is not ahead of the current stage '${currentStage}'.`] };
      }
      const unmet = requirementsForTarget.filter((r) => !r.met).map((r) => r.label);
      if (unmet.length > 0) {
        return { type: "blocked", allowed: false, blockingRules: unmet };
      }
      return { type: "allowed", allowed: true, blockingRules: [] };
    }
    case "skip_optional": {
      if (STAGE_RANK[request.targetStage] <= STAGE_RANK[currentStage]) {
        return { type: "blocked", allowed: false, blockingRules: [`'${request.targetStage}' is not ahead of the current stage '${currentStage}'.`] };
      }
      const skipped = stagesBetween(currentStage, request.targetStage);
      const nonOptional = skipped.filter((s) => !OPTIONAL_SET.has(s));
      if (nonOptional.length > 0) {
        return { type: "blocked", allowed: false, blockingRules: nonOptional.map((s) => `'${s}' is a required stage and cannot be skipped.`) };
      }
      return { type: "skipped_optional", allowed: true, blockingRules: [] };
    }
    case "cancel": {
      if (TERMINAL_SET.has(currentStage)) {
        return { type: "blocked", allowed: false, blockingRules: [`The journey is already '${currentStage}'.`] };
      }
      return { type: "cancelled", allowed: true, blockingRules: [] };
    }
    case "lose": {
      if (STAGE_RANK[currentStage] >= STAGE_RANK.closed) {
        return { type: "blocked", allowed: false, blockingRules: ["A journey that has already reached 'Closed' or later cannot be marked lost."] };
      }
      return { type: "lost", allowed: true, blockingRules: [] };
    }
    case "restore": {
      if (currentStage !== "lost" && currentStage !== "cancelled") {
        return { type: "blocked", allowed: false, blockingRules: [`Only a 'lost' or 'cancelled' journey can be restored (current stage: '${currentStage}').`] };
      }
      return { type: "restored", allowed: true, blockingRules: [] };
    }
    case "reopen": {
      if (STAGE_RANK[request.targetStage] >= STAGE_RANK[currentStage] && !TERMINAL_SET.has(currentStage)) {
        return { type: "blocked", allowed: false, blockingRules: [`'${request.targetStage}' is not earlier than the current stage '${currentStage}'.`] };
      }
      return { type: "reopened", allowed: true, blockingRules: [] };
    }
    default:
      return { type: "blocked", allowed: false, blockingRules: ["Unrecognized transition request."] };
  }
}

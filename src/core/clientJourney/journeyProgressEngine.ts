import type { JourneyMilestone, JourneyProgress, JourneyRequirementResult, JourneyStage } from "@/types/clientJourney";
import { JOURNEY_STAGES, JOURNEY_STAGE_DEFAULT_LABELS, OPTIONAL_JOURNEY_STAGES, TERMINAL_JOURNEY_STAGES } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Progress Engine (Step 7). Progress is
 * weighted by business significance, not by an equal 1/N split, and the
 * weighting is documented here rather than left implicit:
 *
 * - Preparation/administrative stages (drafting, sending) carry a modest
 *   weight (2-4).
 * - The 5 stages that represent a genuine commitment — Proposal Accepted,
 *   Contract Signed, Deposit Paid, Service Completed, Closed — carry a
 *   heavier weight (8-10), since reaching one of these is what actually
 *   de-risks the engagement, not merely administrative progress.
 * - Optional stages (Discovery, Negotiation) are excluded from both the
 *   numerator and denominator of the core percentage — they never being
 *   reached is not incomplete progress, it's a skipped optional step.
 * - Everything from Follow-Up onward is an *extension* of a Closed
 *   journey, not part of reaching Closed, so it is excluded from the core
 *   percentage the same way; it is tracked separately as
 *   `remainingRequiredStages` only continues past Closed when the caller
 *   is already past it.
 */

export const JOURNEY_STAGE_WEIGHTS: Record<JourneyStage, number> = {
  new_lead: 1,
  contacted: 2,
  qualified: 3,
  discovery: 2,
  proposal_preparation: 3,
  proposal_sent: 4,
  negotiation: 2,
  proposal_accepted: 8,
  contract_preparation: 3,
  contract_sent: 4,
  contract_signed: 10,
  invoice_preparation: 2,
  invoice_sent: 3,
  deposit_pending: 2,
  deposit_paid: 8,
  welcome: 4,
  portal_activated: 3,
  planning: 5,
  ready_for_service: 6,
  service_in_progress: 6,
  service_completed: 10,
  final_balance_pending: 3,
  closed: 8,
  follow_up: 2,
  review_requested: 2,
  review_received: 3,
  rebooking_opportunity: 3,
  lost: 0,
  cancelled: 0,
};

export const WEIGHTING_METHOD_DESCRIPTION =
  "Weighted by business significance, not equal split: Proposal Accepted, Contract Signed, Deposit Paid, Service Completed, and Closed carry the heaviest weight (8-10) since they represent genuine commitment; preparation/administrative stages carry 2-4. Optional stages (Discovery, Negotiation) and everything past Closed are excluded from the core percentage. See docs/journey-progress.md.";

const STAGE_RANK: Record<JourneyStage, number> = Object.fromEntries(JOURNEY_STAGES.map((stage, index) => [stage, index])) as Record<JourneyStage, number>;
const OPTIONAL_SET = new Set(OPTIONAL_JOURNEY_STAGES);
const TERMINAL_SET = new Set(TERMINAL_JOURNEY_STAGES);
const CLOSED_RANK = STAGE_RANK.closed;

/** The 21 stages that make up the core, weighted commercial journey from New Lead through Closed — every stage except the optional ones and everything past Closed. */
export const CORE_PROGRESS_STAGES: readonly JourneyStage[] = JOURNEY_STAGES.filter((s) => STAGE_RANK[s] <= CLOSED_RANK && !OPTIONAL_SET.has(s));

export interface ProgressSourceData {
  currentStage: JourneyStage;
  requirementsForCurrentStage: JourneyRequirementResult[];
  stageCompletedAt?: Partial<Record<JourneyStage, string | null>>;
}

export function computeJourneyMilestones(data: ProgressSourceData): JourneyMilestone[] {
  const currentRank = STAGE_RANK[data.currentStage];
  return CORE_PROGRESS_STAGES.map((stage) => ({
    stage,
    label: JOURNEY_STAGE_DEFAULT_LABELS[stage],
    weight: JOURNEY_STAGE_WEIGHTS[stage],
    completed: STAGE_RANK[stage] <= currentRank,
    completedAt: data.stageCompletedAt?.[stage] ?? null,
  }));
}

export function computeJourneyProgress(data: ProgressSourceData): JourneyProgress {
  const currentRank = STAGE_RANK[data.currentStage];
  const isTerminal = TERMINAL_SET.has(data.currentStage);

  const completedStages = CORE_PROGRESS_STAGES.filter((s) => STAGE_RANK[s] <= currentRank);
  const remainingRequiredStages = isTerminal ? [] : CORE_PROGRESS_STAGES.filter((s) => STAGE_RANK[s] > currentRank);
  const optionalStages = [...OPTIONAL_JOURNEY_STAGES];
  const skippedStages = OPTIONAL_JOURNEY_STAGES.filter((s) => STAGE_RANK[s] < currentRank);

  const totalWeight = CORE_PROGRESS_STAGES.reduce((sum, s) => sum + JOURNEY_STAGE_WEIGHTS[s], 0);
  const completedWeight = completedStages.reduce((sum, s) => sum + JOURNEY_STAGE_WEIGHTS[s], 0);
  const overallPercentage = totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);

  const requirementsMet = data.requirementsForCurrentStage.filter((r) => r.met).length;
  const requirementsTotal = data.requirementsForCurrentStage.length;
  const currentStageProgress = requirementsTotal === 0 ? 100 : Math.round((requirementsMet / requirementsTotal) * 100);

  return {
    overallPercentage,
    currentStageProgress,
    completedStages,
    remainingRequiredStages,
    optionalStages,
    blockedStages: [],
    skippedStages,
    weightingMethod: WEIGHTING_METHOD_DESCRIPTION,
  };
}

/** Merges blocker-derived stage ids into an already-computed `JourneyProgress.blockedStages` — kept as a separate step so this engine never has to import the Blocker Engine directly. */
export function withBlockedStages(progress: JourneyProgress, blockedStageIds: JourneyStage[]): JourneyProgress {
  return { ...progress, blockedStages: [...new Set(blockedStageIds)] };
}

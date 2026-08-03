"use server";

import { getCurrentClientAccountContext } from "@/lib/data";
import { buildClientJourney } from "@/modules/clientJourney/clientJourneyActions";
import { JOURNEY_STAGE_DEFAULT_LABELS, type JourneyStage } from "@/types/clientJourney";

/**
 * v2 Checkpoint 44, Step 10 — Client Onboarding, composed entirely from
 * existing Client Journey Platform primitives (Checkpoint 32): the same
 * `buildClientJourney()` the Journey Experience page and Step 8's own
 * journey Merge Field domain already call, never a second journey/
 * onboarding engine. `requirements`/`progress`/`nextBestActions` are read
 * directly off the already-composed `ClientJourney` — this file adds no
 * new business logic of its own, only a narrower, onboarding-scoped
 * projection of it (the same "client-safe projection, never the raw
 * object" pattern `getClientPortalJourneySummary.ts` already established).
 */

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";

/** The `welcome -> portal_activated -> planning` window — the same three stages `JOURNEY_STEPS`' own `"welcome"`/`"client_portal_access"` groupings (`types/clientJourney.ts`) cover, immediately after `deposit_paid` and immediately before `ready_for_service`. */
const ONBOARDING_STAGES: readonly JourneyStage[] = ["welcome", "portal_activated", "planning"];

export interface ClientPortalOnboardingChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  detail: string;
}

export interface ClientPortalOnboarding {
  /** `false` once the Client has moved past `planning` (or hasn't reached `welcome` yet) — the view renders a quiet "not applicable" state rather than stale onboarding content. */
  inOnboarding: boolean;
  currentStageLabel: string;
  progressPercentage: number;
  currentStageProgress: number;
  /** The current stage's own `JourneyRequirementResult[]`, reused as-is — never re-derived. */
  checklist: ClientPortalOnboardingChecklistItem[];
  nextStepLabel: string | null;
}

export type GetClientPortalOnboardingResult = { success: true; data: ClientPortalOnboarding } | { success: false; error: string };

export async function getClientPortalOnboardingAction(): Promise<GetClientPortalOnboardingResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const journey = await buildClientJourney(context.account.workspace_id, "client", context.account.client_id);
  if (!journey) return { success: false, error: GENERIC_ACCESS_ERROR };

  return {
    success: true,
    data: {
      inOnboarding: ONBOARDING_STAGES.includes(journey.currentStage),
      currentStageLabel: JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage],
      progressPercentage: journey.progress.overallPercentage,
      currentStageProgress: journey.progress.currentStageProgress,
      checklist: journey.requirements.map((requirement) => ({ id: requirement.key, title: requirement.label, completed: requirement.met, detail: requirement.detail })),
      nextStepLabel: journey.nextBestActions[0]?.label ?? null,
    },
  };
}

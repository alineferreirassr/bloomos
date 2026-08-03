"use server";

import { getCurrentClientAccountContext } from "@/lib/data";
import { buildClientJourney } from "@/modules/clientJourney/clientJourneyActions";
import { getCoreClientInformationRequestsService } from "@/core/clientJourney";
import { toClientFacing, type ClientFacingInformationRequest } from "@/core/clientJourney/informationRequestEngine";
import { JOURNEY_STAGES, JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import { nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "The Journey Experience isn't available. Please sign in again.";

export type ClientPortalJourneyStepStatus = "completed" | "current" | "upcoming";

export interface ClientPortalJourneyStep {
  stage: string;
  label: string;
  status: ClientPortalJourneyStepStatus;
}

export interface ClientPortalJourneyMilestone {
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface ClientPortalJourneyDetail {
  currentStageLabel: string;
  progressPercentage: number;
  currentStageProgress: number;
  steps: ClientPortalJourneyStep[];
  milestones: ClientPortalJourneyMilestone[];
  notes: ClientFacingInformationRequest[];
}

export type GetClientPortalJourneyDetailResult = { success: true; data: ClientPortalJourneyDetail } | { success: false; error: string };

/**
 * Checkpoint 36, Step 2 — the Journey Experience page's own aggregator.
 * Composes the same `buildClientJourney`/Information Requests engines the
 * dashboard's compact `ClientPortalJourneySummary` (Checkpoint 32) already
 * uses — no second Journey engine. This only adds a fuller, still
 * client-safe projection: every stage step (not just a "current" label),
 * every milestone (not just completed ones), and every Information
 * Request the client can read/respond to (the platform's own "Journey
 * Notes" surface — see `respondToClientPortalJourneyNoteAction` below).
 * `blockers`/`risks`/`owners`/`context` still never leave the server,
 * the same Step 26 privacy line the summary action already draws.
 */
export async function getClientPortalJourneyDetailAction(): Promise<GetClientPortalJourneyDetailResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const journey = await buildClientJourney(context.account.workspace_id, "client", context.account.client_id);
  if (!journey) return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = nowIso();
  const requests = await getCoreClientInformationRequestsService().listRequestsForClient(context.account.workspace_id, context.account.client_id);

  const steps: ClientPortalJourneyStep[] = JOURNEY_STAGES.map((stage) => ({
    stage,
    label: JOURNEY_STAGE_DEFAULT_LABELS[stage],
    status: stage === journey.currentStage ? "current" : journey.progress.completedStages.includes(stage) ? "completed" : "upcoming",
  }));

  const milestones: ClientPortalJourneyMilestone[] = journey.milestones.map((milestone) => ({ label: milestone.label, completed: milestone.completed, completedAt: milestone.completedAt }));

  return {
    success: true,
    data: {
      currentStageLabel: JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage],
      progressPercentage: journey.progress.overallPercentage,
      currentStageProgress: journey.progress.currentStageProgress,
      steps,
      milestones,
      notes: requests.map((request) => toClientFacing(request, now)),
    },
  };
}

/**
 * Checkpoint 36, Step 2 — the one new write action "Journey Notes" needs:
 * a client responding to their own Information Request. Composes the
 * same `recordClientResponse` the internal `respondToInformationRequestAction`
 * (Checkpoint 32) already calls, gated by `ClientAccountContext` instead
 * of the team-member session — the same two-session-mechanism split
 * every other Client Portal write action uses (see `client-billing.md`).
 */
export async function respondToClientPortalJourneyNoteAction(requestId: string, response: string): Promise<DataResult<null>> {
  const trimmed = response.trim();
  if (trimmed.length === 0) return fail("Please fix the highlighted fields.", { response: "A response can't be empty" });

  const context = await getCurrentClientAccountContext();
  if (!context) return fail(GENERIC_ACCESS_ERROR);

  const service = getCoreClientInformationRequestsService();
  const request = await service.getRequestById(requestId);
  if (!request || request.workspaceId !== context.account.workspace_id || request.clientId !== context.account.client_id) return fail(GENERIC_ACCESS_ERROR);

  const result = await service.recordClientResponse(requestId, trimmed);
  if (!result.success) return result;
  return ok(null);
}

"use server";

import { getCurrentClientAccountContext } from "@/lib/data";
import { buildClientJourney } from "@/modules/clientJourney/clientJourneyActions";
import { getCoreClientInformationRequestsService } from "@/core/clientJourney";
import { summarizeRequests, toClientFacing, type ClientFacingInformationRequest } from "@/core/clientJourney/informationRequestEngine";
import { JOURNEY_STAGE_DEFAULT_LABELS } from "@/types/clientJourney";
import { nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32, Step 16 — Client Portal Journey Integration. A
 * deliberately narrow, client-safe projection of `ClientJourney` — never
 * the raw object. Step 26 (Privacy) names exactly what must never reach
 * a client-facing surface: private internal notes, exact financial/
 * contract details, internal risk indicators, ownership assignments. So
 * this summary carries only booleans/labels/counts derived from those
 * fields, never the fields themselves — `blockers`, `risks`, `owners`,
 * and `context` never leave the server.
 */

const GENERIC_ACCESS_ERROR = "The Dashboard isn't available. Please sign in again.";

export interface ClientPortalJourneySummary {
  currentStageLabel: string;
  progressPercentage: number;
  nextStepLabel: string | null;
  pendingSignature: boolean;
  pendingPayment: boolean;
  pendingInformationRequests: ClientFacingInformationRequest[];
  completedMilestoneLabels: string[];
}

export type GetClientPortalJourneySummaryResult = { success: true; data: ClientPortalJourneySummary } | { success: false; error: string };

export async function getClientPortalJourneySummaryAction(): Promise<GetClientPortalJourneySummaryResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const journey = await buildClientJourney(context.account.workspace_id, "client", context.account.client_id);
  if (!journey) return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = nowIso();
  const requests = await getCoreClientInformationRequestsService().listRequestsForClient(context.account.workspace_id, context.account.client_id);
  const pendingRequests = requests.filter((r) => r.status === "pending" || r.status === "overdue").map((r) => toClientFacing(r, now));

  return {
    success: true,
    data: {
      currentStageLabel: JOURNEY_STAGE_DEFAULT_LABELS[journey.currentStage],
      progressPercentage: journey.progress.overallPercentage,
      nextStepLabel: journey.nextBestActions[0]?.label ?? null,
      pendingSignature: journey.blockers.some((b) => b.type === "contract_unsigned"),
      pendingPayment: journey.blockers.some((b) => b.type === "deposit_unpaid" || b.type === "final_balance_unpaid"),
      pendingInformationRequests: pendingRequests,
      completedMilestoneLabels: journey.milestones.filter((m) => m.completed).map((m) => m.label),
    },
  };
}

export async function summarizeInformationRequestsForCurrentClient() {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false as const, error: GENERIC_ACCESS_ERROR };
  const requests = await getCoreClientInformationRequestsService().listRequestsForClient(context.account.workspace_id, context.account.client_id);
  return { success: true as const, data: summarizeRequests(requests, nowIso()) };
}

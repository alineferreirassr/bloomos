import type { ProposalDraft } from "@/types/proposal";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Lead } from "@/types/lead";
import type { JourneyBlocker, JourneyBlockerType, JourneyStage, JourneySubjectType, NextBestAction, NextBestActionType } from "@/types/clientJourney";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Next Best Action Engine (Step 9). Purely
 * deterministic: every action is triggered by a real current stage or a
 * real, already-detected Blocker — nothing here scores or prioritizes
 * anything Executive Decisions already owns. This engine's own output
 * (`journeyRecommendationsForExecutiveDecisions`, wired in the module
 * layer) feeds Executive Decisions the same way every other checkpoint's
 * findings do — it is never a second Executive Decision Engine.
 */

export interface NextBestActionSourceData {
  subjectType: JourneySubjectType;
  subjectId: string;
  currentStage: JourneyStage;
  blockers: JourneyBlocker[];
  lead: Lead | null;
  proposal: ProposalDraft | null;
  contract: Contract | null;
  invoice: Invoice | null;
  reviewRequestedAt: string | null;
  rebookingOfferedAt: string | null;
}

function hasBlocker(blockers: JourneyBlocker[], type: JourneyBlockerType): boolean {
  return blockers.some((b) => b.type === type);
}

function deepLinkFor(data: NextBestActionSourceData): string {
  return data.subjectType === "lead" ? `/leads/${data.subjectId}` : `/clients/${data.subjectId}`;
}

function action(
  type: NextBestActionType,
  label: string,
  reason: string,
  priority: NextBestAction["priority"],
  sourceStage: JourneyStage,
  data: NextBestActionSourceData,
  relatedSourceRecordId: string | null,
): NextBestAction {
  return {
    id: generateId("next_best_action"),
    type,
    label,
    reason,
    priority,
    sourceStage,
    requiredPermission: "client_journeys.manage",
    deepLink: deepLinkFor(data),
    relatedSubjectType: data.subjectType,
    relatedSubjectId: data.subjectId,
    relatedSourceRecordId,
  };
}

export function generateNextBestActions(data: NextBestActionSourceData): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const stage = data.currentStage;

  if (data.subjectType === "lead" && data.lead?.status === "new") {
    actions.push(action("send_first_contact_message", "Send first-contact message", "This lead has not been contacted yet.", "medium", stage, data, data.lead.id));
  }
  if (data.subjectType === "lead" && data.lead && ["contacted", "welcome_guide_sent", "consultation_scheduled"].includes(data.lead.status)) {
    actions.push(action("complete_qualification", "Complete qualification", "This lead is being contacted but has not been qualified.", "medium", stage, data, data.lead.id));
  }
  if (stage === "qualified") {
    actions.push(action("schedule_discovery_placeholder", "Schedule discovery placeholder", "This lead is qualified and ready for a discovery conversation.", "low", stage, data, data.lead?.id ?? null));
  }
  if (stage === "proposal_preparation") {
    actions.push(action("finish_proposal", "Finish proposal", "A proposal draft exists but is not yet complete.", "medium", stage, data, data.proposal?.id ?? null));
  }
  if (data.proposal && data.proposal.reviewed_at === null && data.proposal.status === "draft") {
    actions.push(action("send_proposal", "Send proposal", "The proposal draft has not been internally reviewed and sent yet.", "high", stage, data, data.proposal.id));
  }
  if (hasBlocker(data.blockers, "proposal_not_accepted")) {
    actions.push(action("follow_up_on_proposal", "Follow up on proposal", "The proposal has been sent but the client has not responded.", "high", stage, data, data.proposal?.id ?? null));
  }
  if (hasBlocker(data.blockers, "contract_missing")) {
    actions.push(action("create_contract", "Create contract", "The proposal was accepted but no contract exists yet.", "high", stage, data, null));
  }
  if (data.contract && data.contract.sent_at === null && data.contract.signature_status === "unsigned") {
    actions.push(action("send_contract", "Send contract", "A contract exists but has not been sent to the client.", "high", stage, data, data.contract.id));
  }
  if (hasBlocker(data.blockers, "contract_unsigned")) {
    actions.push(action("request_signature", "Request signature", "The contract has been sent but is not yet signed.", "critical", stage, data, data.contract?.id ?? null));
  }
  if (hasBlocker(data.blockers, "invoice_missing")) {
    actions.push(action("create_invoice", "Create invoice", "The contract is signed but no invoice exists yet.", "high", stage, data, null));
  }
  if (data.invoice && data.invoice.sent_at === null && data.invoice.status !== "voided") {
    actions.push(action("send_invoice", "Send invoice", "An invoice exists but has not been sent to the client.", "high", stage, data, data.invoice.id));
  }
  if (hasBlocker(data.blockers, "deposit_unpaid")) {
    actions.push(action("follow_up_on_deposit", "Follow up on deposit", "The required deposit has not been paid yet.", "critical", stage, data, data.invoice?.id ?? null));
  }
  if (hasBlocker(data.blockers, "missing_portal_access")) {
    actions.push(action("activate_client_portal", "Activate Client Portal", "The client does not have active Client Portal access yet.", "medium", stage, data, null));
  }
  if (stage === "welcome") {
    actions.push(action("send_welcome_message", "Send welcome message", "The client has met every prerequisite for onboarding.", "medium", stage, data, null));
  }
  if (hasBlocker(data.blockers, "missing_client_documents")) {
    actions.push(action("request_missing_information", "Request missing information", "One or more required documents are still missing.", "medium", stage, data, null));
  }
  if (stage === "planning") {
    actions.push(action("prepare_service_instructions", "Prepare service instructions", "The event has moved into planning.", "medium", stage, data, null));
  }
  if (hasBlocker(data.blockers, "final_balance_unpaid")) {
    actions.push(action("request_final_payment", "Request final payment", "The event is complete and a balance remains outstanding.", "critical", stage, data, data.invoice?.id ?? null));
  }
  if (stage === "service_completed" || stage === "closed") {
    actions.push(action("send_completion_message", "Send completion message", "The service has been completed.", "low", stage, data, null));
  }
  if (stage === "closed" && data.reviewRequestedAt === null) {
    actions.push(action("request_review", "Request review", "The journey is closed and no review has been requested yet.", "low", stage, data, null));
  }
  if ((stage === "review_received" || stage === "closed") && data.rebookingOfferedAt === null) {
    actions.push(action("create_rebooking_opportunity", "Create rebooking opportunity", "This is a good moment to offer the client a future booking.", "low", stage, data, null));
  }

  return actions;
}

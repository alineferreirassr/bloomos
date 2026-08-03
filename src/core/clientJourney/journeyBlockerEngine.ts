import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { ProposalDraft } from "@/types/proposal";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Event } from "@/types/event";
import type { ClientAccount } from "@/types/clientAccount";
import type { JourneyBlocker, JourneyStage, JourneySubjectType } from "@/types/clientJourney";
import { JOURNEY_STAGES } from "@/types/clientJourney";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Journey Blocker Engine (Step 6). Every one of the
 * 17 named blocker types reads an existing field or an already-computed
 * caller-supplied input (operational readiness, execution package
 * existence, pending approvals) — never a new calculation duplicating
 * another platform's own logic.
 */

const STAGE_RANK: Record<JourneyStage, number> = Object.fromEntries(JOURNEY_STAGES.map((stage, index) => [stage, index])) as Record<JourneyStage, number>;

export interface BlockerSourceData {
  subjectType: JourneySubjectType;
  lead: Lead | null;
  client: Client | null;
  proposal: ProposalDraft | null;
  acceptedProposal: ProposalDraft | null;
  contract: Contract | null;
  invoice: Invoice | null;
  focusEvent: Event | null;
  clientAccounts: ClientAccount[];
  depositRequired: boolean;
  depositSatisfied: boolean;
  outstandingBalanceMinor: number;
  requiredDocumentsComplete: boolean | null;
  operationalPlanExists: boolean | null;
  executionPackageExists: boolean | null;
  pendingApprovalsCount: number;
  clientResponsePendingCount: number;
  overdueInternalFollowUpsCount: number;
  now: string;
}

function blocker(type: JourneyBlocker["type"], stage: JourneyStage, severity: JourneyBlocker["severity"], sourceModule: string, sourceRecordId: string | null, description: string, suggestedNextAction: string, now: string): JourneyBlocker {
  return { id: generateId("journey_blocker"), type, stage, severity, sourceModule, sourceRecordId, description, suggestedNextAction, detectedAt: now };
}

export function detectJourneyBlockers(currentStage: JourneyStage, data: BlockerSourceData): JourneyBlocker[] {
  const rank = STAGE_RANK[currentStage];
  const blockers: JourneyBlocker[] = [];
  const portalActive = data.clientAccounts.some((a) => a.status === "active");

  if (data.subjectType === "lead" && data.lead && !data.lead.email && !data.lead.phone) {
    blockers.push(blocker("missing_contact_information", "contacted", "high", "leads", data.lead.id, "This lead has no email or phone on file.", "Collect at least one contact method before proceeding.", data.now));
  }

  if (data.subjectType === "lead" && data.lead && rank >= STAGE_RANK.contacted && (data.lead.status === "new" || data.lead.status === "contacted")) {
    blockers.push(blocker("lead_not_qualified", "qualified", "medium", "leads", data.lead.id, "This lead has not been marked qualified yet.", "Complete qualification for this lead.", data.now));
  }

  if (data.proposal && data.proposal.status === "draft" && (data.proposal.services_included.length === 0 || data.proposal.pricing_summary.subtotal_minor === 0)) {
    blockers.push(blocker("proposal_incomplete", "proposal_preparation", "medium", "proposal", data.proposal.id, "The current proposal draft is missing services or pricing.", "Finish the proposal draft before sending.", data.now));
  }

  if (rank >= STAGE_RANK.proposal_sent && data.proposal && data.proposal.status !== "rejected" && !data.acceptedProposal) {
    blockers.push(blocker("proposal_not_accepted", "proposal_accepted", "medium", "proposal", data.proposal.id, "The proposal has been sent but not yet accepted.", "Follow up with the client on the outstanding proposal.", data.now));
  }

  if (data.acceptedProposal && !data.contract) {
    blockers.push(blocker("contract_missing", "contract_preparation", "high", "contract", null, "The proposal was accepted but no contract has been created.", "Create a contract for the accepted proposal.", data.now));
  }

  if (data.contract && data.contract.signature_status !== "signed" && data.contract.status !== "declined" && data.contract.status !== "cancelled") {
    blockers.push(blocker("contract_unsigned", "contract_signed", "high", "contract", data.contract.id, `Contract signature status is '${data.contract.signature_status}'.`, "Request the client's signature on the contract.", data.now));
  }

  if (data.contract?.signature_status === "signed" && !data.invoice) {
    blockers.push(blocker("invoice_missing", "invoice_preparation", "high", "invoice", null, "The contract is signed but no invoice has been created.", "Create an invoice for the signed contract.", data.now));
  }

  if (data.depositRequired && !data.depositSatisfied) {
    blockers.push(blocker("deposit_unpaid", "deposit_paid", "critical", "finance", data.invoice?.id ?? null, "The required deposit has not been paid.", "Follow up with the client on the outstanding deposit.", data.now));
  }

  if (data.focusEvent?.status === "completed" && data.outstandingBalanceMinor > 0) {
    blockers.push(blocker("final_balance_unpaid", "final_balance_pending", "critical", "finance", data.invoice?.id ?? null, "The event is complete but a balance remains outstanding.", "Request the final payment from the client.", data.now));
  }

  if (rank >= STAGE_RANK.welcome && !portalActive) {
    blockers.push(blocker("missing_portal_access", "portal_activated", "medium", "clientPortal", data.client?.id ?? null, "The client does not yet have an active Client Portal account.", "Activate Client Portal access for this client.", data.now));
  }

  if (data.requiredDocumentsComplete === false) {
    blockers.push(blocker("missing_client_documents", "ready_for_service", "medium", "documents", data.client?.id ?? null, "One or more required client documents are missing.", "Request the missing documents from the client.", data.now));
  }

  if (data.pendingApprovalsCount > 0) {
    blockers.push(blocker("missing_approval", currentStage, "medium", "operationalPlanning", data.focusEvent?.id ?? null, `${data.pendingApprovalsCount} internal approval(s) are still pending.`, "Resolve the pending internal approval(s).", data.now));
  }

  if (data.focusEvent && (!data.focusEvent.event_date || !data.focusEvent.guest_count)) {
    blockers.push(blocker("missing_event_information", "discovery", "low", "events", data.focusEvent.id, "The event is missing a date or guest count.", "Collect the missing event details.", data.now));
  }

  if (rank >= STAGE_RANK.planning && data.operationalPlanExists === false) {
    blockers.push(blocker("missing_operational_plan", "planning", "high", "operationalPlanning", data.focusEvent?.id ?? null, "No operational plan exists yet for this event.", "Create an operational plan for this event.", data.now));
  }

  if (rank >= STAGE_RANK.ready_for_service && data.executionPackageExists === false) {
    blockers.push(blocker("missing_execution_package", "ready_for_service", "high", "executionPackage", data.focusEvent?.id ?? null, "No execution package exists yet for this event.", "Build an execution package for this event.", data.now));
  }

  if (data.clientResponsePendingCount > 0) {
    blockers.push(blocker("client_response_pending", currentStage, "medium", "clientJourney", data.client?.id ?? data.lead?.id ?? null, `${data.clientResponsePendingCount} information request(s) are awaiting a client response.`, "Follow up with the client on the outstanding request(s).", data.now));
  }

  if (data.overdueInternalFollowUpsCount > 0) {
    blockers.push(blocker("internal_follow_up_overdue", currentStage, "medium", "communication", data.client?.id ?? data.lead?.id ?? null, `${data.overdueInternalFollowUpsCount} internal follow-up reminder(s) are overdue.`, "Complete the overdue internal follow-up(s).", data.now));
  }

  return blockers;
}

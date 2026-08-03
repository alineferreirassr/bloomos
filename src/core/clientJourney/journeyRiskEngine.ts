import type { Lead } from "@/types/lead";
import type { ProposalDraft } from "@/types/proposal";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Event } from "@/types/event";
import type { JourneyRisk, JourneyStage } from "@/types/clientJourney";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 32 — Journey Risk Engine (Step 21). Every one of the 12
 * named risks is a plain elapsed-time or already-known-field check against
 * data the journey already has — no prediction, no scoring model, fully
 * explainable from the description string alone. Threshold constants are
 * named and documented rather than left as magic numbers.
 */

const LEAD_GOING_COLD_DAYS = 7;
const PROPOSAL_STALLED_DAYS = 10;
const CONTRACT_STALLED_DAYS = 7;
const DEPOSIT_DELAYED_DAYS = 5;
const CLIENT_UNRESPONSIVE_DAYS = 3;
const PLANNING_DELAY_LEAD_TIME_DAYS = 30;
const DOCUMENT_DEADLINE_LEAD_TIME_DAYS = 14;
const FINAL_BALANCE_RISK_LEAD_TIME_DAYS = 14;
const REVIEW_OPPORTUNITY_WINDOW_DAYS = 30;
const REBOOKING_OPPORTUNITY_WINDOW_DAYS = 90;

function daysBetween(earlierIso: string, laterIso: string): number {
  return Math.floor((new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / (1000 * 60 * 60 * 24));
}

export interface RiskSourceData {
  now: string;
  currentStage: JourneyStage;
  lead: Lead | null;
  proposal: ProposalDraft | null;
  contract: Contract | null;
  invoice: Invoice | null;
  focusEvent: Event | null;
  portalActive: boolean;
  depositRequired: boolean;
  depositSatisfied: boolean;
  requiredDocumentsComplete: boolean | null;
  operationalPlanExists: boolean | null;
  oldestPendingRequestDueDate: string | null;
  closedAt: string | null;
  reviewRequestedAt: string | null;
  rebookingOfferedAt: string | null;
}

function risk(type: JourneyRisk["type"], severity: JourneyRisk["severity"], stage: JourneyStage, description: string, sourceRecordId: string | null, now: string): JourneyRisk {
  return { id: generateId("journey_risk"), type, severity, stage, description, sourceRecordId, detectedAt: now };
}

export function detectJourneyRisks(data: RiskSourceData): JourneyRisk[] {
  const risks: JourneyRisk[] = [];
  const stage = data.currentStage;

  if (data.lead && daysBetween(data.lead.updated_at, data.now) >= LEAD_GOING_COLD_DAYS && ["new", "contacted"].includes(data.lead.status)) {
    risks.push(risk("lead_going_cold", "medium", stage, `No lead activity recorded in ${daysBetween(data.lead.updated_at, data.now)} day(s).`, data.lead.id, data.now));
  }

  if (data.proposal && data.proposal.reviewed_at !== null && data.proposal.status === "draft" && daysBetween(data.proposal.updated_at, data.now) >= PROPOSAL_STALLED_DAYS) {
    risks.push(risk("proposal_stalled", "high", stage, `The proposal has been awaiting a client decision for ${daysBetween(data.proposal.updated_at, data.now)} day(s).`, data.proposal.id, data.now));
  }

  if (data.contract && data.contract.sent_at !== null && data.contract.signature_status !== "signed" && daysBetween(data.contract.sent_at, data.now) >= CONTRACT_STALLED_DAYS) {
    risks.push(risk("contract_stalled", "high", stage, `The contract has been awaiting signature for ${daysBetween(data.contract.sent_at, data.now)} day(s).`, data.contract.id, data.now));
  }

  if (data.invoice && (data.invoice.status === "overdue" || (data.invoice.due_date !== null && data.invoice.due_date < data.now && data.invoice.balance_minor > 0))) {
    risks.push(risk("invoice_overdue", "critical", stage, `Invoice is overdue (due ${data.invoice.due_date}).`, data.invoice.id, data.now));
  }

  if (data.depositRequired && !data.depositSatisfied && data.invoice?.sent_at && daysBetween(data.invoice.sent_at, data.now) >= DEPOSIT_DELAYED_DAYS) {
    risks.push(risk("deposit_delayed", "high", stage, `The deposit has been outstanding for ${daysBetween(data.invoice.sent_at, data.now)} day(s) since the invoice was sent.`, data.invoice.id, data.now));
  }

  if (data.oldestPendingRequestDueDate && daysBetween(data.oldestPendingRequestDueDate, data.now) >= CLIENT_UNRESPONSIVE_DAYS) {
    risks.push(risk("client_unresponsive", "medium", stage, `An information request has been overdue for ${daysBetween(data.oldestPendingRequestDueDate, data.now)} day(s).`, null, data.now));
  }

  if (data.focusEvent?.event_date && data.operationalPlanExists === false && daysBetween(data.now, data.focusEvent.event_date) <= PLANNING_DELAY_LEAD_TIME_DAYS) {
    risks.push(risk("planning_delayed", "high", stage, `No operational plan exists and the event is ${daysBetween(data.now, data.focusEvent.event_date)} day(s) away.`, data.focusEvent.id, data.now));
  }

  if (!data.portalActive && stage !== "portal_activated") {
    const ranksPastWelcome: JourneyStage[] = ["planning", "ready_for_service", "service_in_progress", "service_completed", "final_balance_pending", "closed"];
    if (ranksPastWelcome.includes(stage)) {
      risks.push(risk("portal_not_activated", "medium", stage, "Client Portal access has still not been activated for this client.", null, data.now));
    }
  }

  if (data.focusEvent?.event_date && data.requiredDocumentsComplete === false && daysBetween(data.now, data.focusEvent.event_date) <= DOCUMENT_DEADLINE_LEAD_TIME_DAYS) {
    risks.push(risk("missing_documents", "high", stage, `Required documents are still missing and the event is ${daysBetween(data.now, data.focusEvent.event_date)} day(s) away.`, data.focusEvent.id, data.now));
  }

  if (data.focusEvent?.event_date && data.focusEvent.status !== "completed" && daysBetween(data.now, data.focusEvent.event_date) <= FINAL_BALANCE_RISK_LEAD_TIME_DAYS && data.depositRequired && !data.depositSatisfied) {
    risks.push(risk("final_balance_risk", "critical", stage, `The event is ${daysBetween(data.now, data.focusEvent.event_date)} day(s) away with payment still outstanding.`, data.focusEvent?.id ?? null, data.now));
  }

  if (stage === "closed" && data.closedAt && daysBetween(data.closedAt, data.now) >= REVIEW_OPPORTUNITY_WINDOW_DAYS && data.reviewRequestedAt === null) {
    risks.push(risk("review_opportunity_missed", "low", stage, `The journey closed ${daysBetween(data.closedAt, data.now)} day(s) ago and no review has been requested.`, null, data.now));
  }

  if ((stage === "closed" || stage === "review_received") && data.closedAt && daysBetween(data.closedAt, data.now) >= REBOOKING_OPPORTUNITY_WINDOW_DAYS && data.rebookingOfferedAt === null) {
    risks.push(risk("rebooking_opportunity_missed", "low", stage, `The journey closed ${daysBetween(data.closedAt, data.now)} day(s) ago and no rebooking opportunity has been created.`, null, data.now));
  }

  return risks;
}

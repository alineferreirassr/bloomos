import type { Client } from "@/types/client";
import type { ProposalDraft } from "@/types/proposal";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Event } from "@/types/event";
import type { ClientAccount } from "@/types/clientAccount";
import type { Lead } from "@/types/lead";
import type { JourneyRequirementResult, JourneyStage } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Journey Requirements Engine (Step 5). Requirement
 * sets are defined for exactly the 7 stages the spec itself names
 * (Qualified/Proposal Sent/Contract Sent/Contract Signed/Invoice Sent/
 * Welcome/Ready for Service) — every check reads an existing field or an
 * already-computed input, never a new calculation. Every other stage
 * returns an empty requirement list; it is evidenced directly by the
 * State Resolver (Step 3) instead, so this engine never duplicates that
 * logic for stages the spec didn't ask it to gate.
 */

export interface RequirementsSourceData {
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
  /** Reused verbatim from Operational Planning/Execution Package readiness — never recalculated here. `null` when no operational plan exists yet for the focus event. */
  operationalReadinessScore: number | null;
  /** Reused from Documents module ("required documents" concept, Step 26). `null` when not evaluated by the caller. */
  requiredDocumentsComplete: boolean | null;
}

function req(key: string, label: string, stage: JourneyStage, met: boolean, sourceModule: string, sourceRecordId: string | null, detail: string): JourneyRequirementResult {
  return { key, label, stage, met, sourceModule, sourceRecordId, detail };
}

export function evaluateStageRequirements(stage: JourneyStage, data: RequirementsSourceData): JourneyRequirementResult[] {
  switch (stage) {
    case "qualified": {
      const lead = data.lead;
      const infoComplete = !!lead && !!lead.first_name && !!lead.last_name && (!!lead.email || !!lead.phone);
      return [
        req("lead_information_complete", "Lead information complete", stage, infoComplete, "leads", lead?.id ?? null, infoComplete ? "Name and at least one contact method are recorded." : "Missing name or contact method."),
        req("service_interest_recorded", "Service interest recorded", stage, !!lead?.event_type, "leads", lead?.id ?? null, lead?.event_type ? `Event type: ${lead.event_type}.` : "No event type recorded."),
        req(
          "budget_range_recorded",
          "Budget range recorded where available",
          stage,
          true,
          "leads",
          lead?.id ?? null,
          lead?.budget_min !== null && lead?.budget_min !== undefined ? "Budget range provided." : "Optional field — not blocking when absent.",
        ),
        req("contact_permission_confirmed", "Contact permission confirmed where applicable", stage, true, "leads", lead?.id ?? null, "No dedicated consent field exists in this codebase; treated as satisfied."),
      ];
    }
    case "proposal_sent": {
      const p = data.proposal;
      const hasServices = (p?.services_included?.length ?? 0) > 0;
      const hasPricing = (p?.pricing_summary?.subtotal_minor ?? 0) > 0;
      const sendable = !!p && p.status !== "rejected" && p.reviewed_at !== null;
      return [
        req("proposal_exists", "Proposal exists", stage, !!p, "proposal", p?.id ?? null, p ? `Proposal ${p.id} found.` : "No proposal exists yet."),
        req("proposal_has_client", "Proposal has client", stage, !!p?.client_id, "proposal", p?.id ?? null, p?.client_id ? `Linked to client ${p.client_id}.` : "No client linkage."),
        req("proposal_has_services", "Proposal has services", stage, hasServices, "proposal", p?.id ?? null, hasServices ? `${p?.services_included.length} service line(s).` : "No services listed."),
        req("proposal_has_pricing", "Proposal has pricing", stage, hasPricing, "proposal", p?.id ?? null, hasPricing ? "Pricing summary is non-zero." : "No pricing recorded."),
        req(
          "proposal_sendable_state",
          "Proposal is in sendable state",
          stage,
          sendable,
          "proposal",
          p?.id ?? null,
          sendable ? "Internally reviewed and not rejected." : "Not yet reviewed, or was rejected.",
        ),
      ];
    }
    case "contract_sent": {
      const c = data.contract;
      const infoComplete = !!data.client && !!data.client.email && (!!data.client.phone || !!data.client.address);
      return [
        req("accepted_proposal_exists", "Accepted proposal exists", stage, !!data.acceptedProposal, "proposal", data.acceptedProposal?.id ?? null, data.acceptedProposal ? "An accepted proposal exists." : "No accepted proposal found."),
        req("contract_exists", "Contract exists", stage, !!c, "contract", c?.id ?? null, c ? `Contract ${c.id} found.` : "No contract exists yet."),
        req(
          "required_clauses_exist",
          "Required clauses exist",
          stage,
          !!c && (c.description?.trim().length ?? 0) > 0,
          "contract",
          c?.id ?? null,
          "Proxy: Contract has no dedicated clause list in this codebase; a non-empty description is treated as clauses present.",
        ),
        req("client_information_complete", "Client information is complete", stage, infoComplete, "client", data.client?.id ?? null, infoComplete ? "Email and phone/address on file." : "Missing email or phone/address."),
      ];
    }
    case "contract_signed": {
      const c = data.contract;
      const signed = c?.signature_status === "signed";
      return [
        req("signature_status_completed", "Signature status completed", stage, signed, "contract", c?.id ?? null, `signature_status is '${c?.signature_status ?? "n/a"}'.`),
        req(
          "required_signers_completed",
          "Required signers completed",
          stage,
          signed,
          "contract",
          c?.id ?? null,
          "Proxy: Contract tracks one aggregate signature_status, not a per-signer list, in this codebase.",
        ),
        req("audit_trail_exists", "Audit trail exists", stage, (c?.version_history.length ?? 0) > 0, "contract", c?.id ?? null, `${c?.version_history.length ?? 0} version snapshot(s) recorded.`),
      ];
    }
    case "invoice_sent": {
      const inv = data.invoice;
      return [
        req("invoice_exists", "Invoice exists", stage, !!inv, "invoice", inv?.id ?? null, inv ? `Invoice ${inv.id} found.` : "No invoice exists yet."),
        req("client_exists", "Client exists", stage, !!data.client, "client", data.client?.id ?? null, data.client ? "Client record found." : "No client record."),
        req("invoice_total_valid", "Invoice total is valid", stage, (inv?.total_minor ?? 0) > 0, "invoice", inv?.id ?? null, `total_minor is ${inv?.total_minor ?? 0}.`),
        req("due_date_exists", "Due date exists", stage, !!inv?.due_date, "invoice", inv?.id ?? null, inv?.due_date ? `Due ${inv.due_date}.` : "No due date recorded."),
      ];
    }
    case "welcome": {
      const contractSatisfied = !data.contract || data.contract.signature_status === "signed";
      return [
        req("proposal_accepted", "Proposal accepted", stage, !!data.acceptedProposal, "proposal", data.acceptedProposal?.id ?? null, data.acceptedProposal ? "Accepted." : "Not yet accepted."),
        req("contract_signed_where_required", "Contract signed where required", stage, contractSatisfied, "contract", data.contract?.id ?? null, contractSatisfied ? "Signed, or no contract required." : "Contract exists but is unsigned."),
        req("deposit_paid_where_required", "Deposit paid where required", stage, data.depositSatisfied, "finance", data.invoice?.id ?? null, data.depositSatisfied ? "Deposit satisfied, or none required." : "Deposit is required and unpaid."),
        req("client_portal_account_ready", "Client portal account ready", stage, true, "clientPortal", null, "Checked at the Portal Activated stage itself, not a gate for entering Welcome."),
      ];
    }
    case "ready_for_service": {
      const docsComplete = data.requiredDocumentsComplete ?? true;
      const eventReady = !!data.focusEvent && (data.focusEvent.status === "ready" || ["preparation", "setup"].includes(data.focusEvent.lifecycle_stage));
      const operationallyReady = data.operationalReadinessScore === null ? true : data.operationalReadinessScore >= 80;
      return [
        req("required_documents_complete", "Required documents complete", stage, docsComplete, "documents", null, data.requiredDocumentsComplete === null ? "Not evaluated by the caller; treated as satisfied." : docsComplete ? "All required documents present." : "One or more required documents are missing."),
        req("required_payments_complete", "Required payments complete", stage, data.depositSatisfied, "finance", data.invoice?.id ?? null, data.depositSatisfied ? "Deposit satisfied." : "Deposit still outstanding."),
        req("event_or_project_ready", "Event or project ready", stage, eventReady, "events", data.focusEvent?.id ?? null, `Event status/lifecycle_stage is '${data.focusEvent?.status}'/'${data.focusEvent?.lifecycle_stage}'.`),
        req(
          "operational_requirements_complete",
          "Operational requirements complete",
          stage,
          operationallyReady,
          "operationalPlanning",
          data.focusEvent?.id ?? null,
          data.operationalReadinessScore === null ? "No operational plan evaluated yet; treated as satisfied." : `Reused Operational Readiness score: ${data.operationalReadinessScore}.`,
        ),
      ];
    }
    default:
      return [];
  }
}

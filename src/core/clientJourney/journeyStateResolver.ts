import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { ProposalDraft } from "@/types/proposal";
import type { Contract } from "@/types/contract";
import type { Invoice } from "@/types/invoice";
import type { Payment } from "@/types/payment";
import type { Event } from "@/types/event";
import type { ClientAccount } from "@/types/clientAccount";
import type { EventFinancialSummary } from "@/modules/finance/financialSummary";
import type { JourneyStage, JourneySubjectType, JourneyTransitionRecord } from "@/types/clientJourney";
import { JOURNEY_STAGES, TERMINAL_JOURNEY_STAGES } from "@/types/clientJourney";

/**
 * v2.0 Checkpoint 32 — Client Journey State Resolver (Step 3). Derives the
 * *current* stage purely from facts already recorded by Leads/Clients/
 * Proposals/Contracts/Invoices/Events/Client Portal — it never writes to
 * any of them and never invents a fact those modules don't already carry.
 *
 * Two disclosed proxies, used because the source modules genuinely have no
 * field for the distinction the spec asks for:
 * - `ProposalDraft` has no "sent"/"viewed" state (research confirmed
 *   `ProposalStatus` is only `draft | accepted | rejected | superseded`).
 *   `reviewed_at` (set when a team member reviews/approves a draft) is
 *   used as the "Proposal Sent" signal — an internally-approved proposal is
 *   treated as presented to the client. An unreviewed draft reads as
 *   "Proposal Preparation" only.
 * - "Discovery"/"Negotiation" are optional stages with no dedicated source
 *   field either; Discovery reads from `Lead.status === "consultation_scheduled"`,
 *   Negotiation from a proposal chain with a `parent_proposal_id` (a
 *   regenerated draft implies back-and-forth).
 *
 * Everything from `follow_up` onward (`review_requested`/`review_received`/
 * `rebooking_opportunity`) has no source-module field at all — BloomOS has
 * no review/testimonial module. These stages are reachable only through an
 * explicit, recorded `JourneyTransitionRecord` (Step 4); the resolver
 * never guesses its way past `closed`/`final_balance_pending` on its own.
 */

export interface JourneyStateSourceData {
  subjectType: JourneySubjectType;
  lead: Lead | null;
  client: Client | null;
  proposals: ProposalDraft[];
  contracts: Contract[];
  invoices: Invoice[];
  payments: Payment[];
  events: Event[];
  clientAccounts: ClientAccount[];
  financialSummary: EventFinancialSummary | null;
  latestManualTransition: JourneyTransitionRecord | null;
}

export interface JourneyStateResolution {
  stage: JourneyStage;
  focusEventId: string | null;
  focusProposalId: string | null;
  focusContractId: string | null;
  focusInvoiceId: string | null;
  rationale: string;
}

const STAGE_RANK: Record<JourneyStage, number> = Object.fromEntries(JOURNEY_STAGES.map((stage, index) => [stage, index])) as Record<JourneyStage, number>;

const POST_CLOSED_STAGES: readonly JourneyStage[] = ["follow_up", "review_requested", "review_received", "rebooking_opportunity"];

export function mostRecentEvent(events: Event[]): Event | null {
  const active = events.filter((e) => e.archived_at === null);
  const pool = active.length > 0 ? active : events;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function latestProposal(proposals: ProposalDraft[]): ProposalDraft | null {
  if (proposals.length === 0) return null;
  return [...proposals].sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at))[0];
}

export function acceptedProposal(proposals: ProposalDraft[]): ProposalDraft | null {
  return proposals.find((p) => p.status === "accepted") ?? null;
}

export function primaryContract(contracts: Contract[]): Contract | null {
  if (contracts.length === 0) return null;
  const active = contracts.filter((c) => c.status !== "cancelled" && c.status !== "declined" && c.status !== "archived");
  const pool = active.length > 0 ? active : contracts;
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function primaryInvoice(invoices: Invoice[]): Invoice | null {
  if (invoices.length === 0) return null;
  const active = invoices.filter((i) => i.status !== "voided" && i.status !== "archived");
  const pool = active.length > 0 ? active : invoices;
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

export function hasSucceededDepositPayment(payments: Payment[]): boolean {
  return payments.some((p) => p.status === "succeeded" && (p.payment_type === "deposit" || p.payment_type === "retainer"));
}

export function activePortalAccount(accounts: ClientAccount[]): ClientAccount | null {
  return accounts.find((a) => a.status === "active") ?? null;
}

export function resolveClientJourneyState(data: JourneyStateSourceData): JourneyStateResolution {
  const focusEvent = mostRecentEvent(data.events);
  const proposal = latestProposal(data.proposals);
  const accepted = acceptedProposal(data.proposals);
  const contract = primaryContract(data.contracts);
  const invoice = primaryInvoice(data.invoices);
  const portalAccount = activePortalAccount(data.clientAccounts);
  const depositRequired = (data.financialSummary?.deposit_required_minor ?? 0) > 0;
  const depositSatisfied = !depositRequired || (data.financialSummary?.deposit_balance_minor ?? 0) <= 0 || hasSucceededDepositPayment(data.payments);
  const outstanding = data.financialSummary?.outstanding_minor ?? 0;

  const base = { focusEventId: focusEvent?.id ?? null, focusProposalId: proposal?.id ?? null, focusContractId: contract?.id ?? null, focusInvoiceId: invoice?.id ?? null };

  // Lost / Cancelled short-circuit — real, unambiguous signals only.
  if (data.subjectType === "lead" && data.lead?.status === "lost") {
    return { ...base, stage: "lost", rationale: "Lead.status is 'lost'." };
  }
  if (focusEvent?.status === "cancelled") {
    return { ...base, stage: "cancelled", rationale: `Event ${focusEvent.id}.status is 'cancelled'.` };
  }
  if (data.latestManualTransition?.type === "cancelled") {
    return { ...base, stage: "cancelled", rationale: "Most recent recorded transition is a manual Cancel." };
  }
  if (data.latestManualTransition?.type === "lost") {
    return { ...base, stage: "lost", rationale: "Most recent recorded transition is a manual Lose." };
  }

  const evidence: { stage: JourneyStage; met: boolean; rationale: string }[] = [
    { stage: "new_lead", met: data.subjectType === "lead", rationale: "Lead record exists with no further recorded activity." },
    {
      stage: "contacted",
      met: data.subjectType === "lead" && !!data.lead && data.lead.status !== "new",
      rationale: `Lead.status is '${data.lead?.status}'.`,
    },
    {
      stage: "qualified",
      met: (data.subjectType === "lead" && (data.lead?.status === "qualified" || data.lead?.status === "proposal_sent" || data.lead?.status === "waiting_decision" || data.lead?.status === "converted")) || data.subjectType === "client",
      rationale: data.subjectType === "client" ? "Client record exists (conversion implies qualification)." : `Lead.status is '${data.lead?.status}'.`,
    },
    {
      stage: "discovery",
      met: data.subjectType === "lead" && data.lead?.status === "consultation_scheduled",
      rationale: "Lead.status is 'consultation_scheduled'.",
    },
    {
      stage: "proposal_preparation",
      met: data.subjectType === "client" && !!proposal,
      rationale: `Proposal ${proposal?.id} exists in status '${proposal?.status}'.`,
    },
    {
      stage: "proposal_sent",
      met: data.subjectType === "client" && !!proposal && proposal.reviewed_at !== null && proposal.status !== "rejected",
      rationale: `Proposal ${proposal?.id} has been internally reviewed (reviewed_at set) — treated as presented to the client.`,
    },
    {
      stage: "negotiation",
      met: data.subjectType === "client" && !!proposal && proposal.parent_proposal_id !== null && proposal.status !== "accepted",
      rationale: `Proposal ${proposal?.id} is a revision of a prior draft (parent_proposal_id set).`,
    },
    {
      stage: "proposal_accepted",
      met: !!accepted,
      rationale: `Proposal ${accepted?.id} has status 'accepted'.`,
    },
    {
      stage: "contract_preparation",
      met: !!contract,
      rationale: `Contract ${contract?.id} exists in status '${contract?.status}'.`,
    },
    {
      stage: "contract_sent",
      met: !!contract && (contract.sent_at !== null || ["sent", "viewed", "signed", "completed"].includes(contract.status)),
      rationale: `Contract ${contract?.id}.sent_at is set or status is '${contract?.status}'.`,
    },
    {
      stage: "contract_signed",
      met: !!contract && (contract.signature_status === "signed" || contract.status === "signed" || contract.status === "completed"),
      rationale: `Contract ${contract?.id}.signature_status is '${contract?.signature_status}'.`,
    },
    {
      stage: "invoice_preparation",
      met: !!invoice,
      rationale: `Invoice ${invoice?.id} exists in status '${invoice?.status}'.`,
    },
    {
      stage: "invoice_sent",
      met: !!invoice && (invoice.sent_at !== null || ["issued", "sent", "viewed", "partially_paid", "paid", "overdue"].includes(invoice.status)),
      rationale: `Invoice ${invoice?.id}.sent_at is set or status is '${invoice?.status}'.`,
    },
    {
      stage: "deposit_pending",
      met: !!invoice && depositRequired && !depositSatisfied,
      rationale: "A deposit is required (Finance summary) and has not yet been satisfied.",
    },
    {
      stage: "deposit_paid",
      met: !!invoice && depositSatisfied,
      rationale: depositRequired ? "Finance summary shows the required deposit fully paid." : "No deposit is required for this Contract.",
    },
    {
      // Deliberately requires an *actual* signed Contract, never "no
      // Contract exists yet" as a stand-in for "no Contract required" —
      // there is no domain flag distinguishing those two cases, and
      // treating a merely-absent Contract as satisfied would let the
      // resolver jump straight from Proposal Accepted to Welcome before
      // Contract Preparation/Sent/Signed were ever evidenced.
      stage: "welcome",
      met: !!accepted && !!contract && (contract.signature_status === "signed" || contract.status === "signed" || contract.status === "completed") && depositSatisfied,
      rationale: "Proposal accepted, Contract signed, and deposit satisfied.",
    },
    {
      stage: "portal_activated",
      met: !!portalAccount,
      rationale: `Client Account ${portalAccount?.id} has status 'active'.`,
    },
    {
      stage: "planning",
      met: !!focusEvent && (focusEvent.lifecycle_stage === "planning" || focusEvent.status === "planning"),
      rationale: `Event ${focusEvent?.id}.lifecycle_stage is '${focusEvent?.lifecycle_stage}'.`,
    },
    {
      stage: "ready_for_service",
      met: !!focusEvent && (focusEvent.status === "ready" || ["preparation", "setup"].includes(focusEvent.lifecycle_stage)),
      rationale: `Event ${focusEvent?.id}.status is '${focusEvent?.status}'.`,
    },
    {
      stage: "service_in_progress",
      met: !!focusEvent && (focusEvent.status === "in_progress" || ["execution", "live_event"].includes(focusEvent.lifecycle_stage)),
      rationale: `Event ${focusEvent?.id}.status is '${focusEvent?.status}'.`,
    },
    {
      stage: "final_balance_pending",
      met: !!focusEvent && focusEvent.status === "completed" && outstanding > 0,
      rationale: `Event ${focusEvent?.id} is completed and Finance summary shows an outstanding balance.`,
    },
    {
      stage: "closed",
      met: !!focusEvent && focusEvent.status === "completed" && outstanding <= 0,
      rationale: `Event ${focusEvent?.id} is completed and Finance summary shows no outstanding balance.`,
    },
  ];

  let resolved: { stage: JourneyStage; rationale: string } = { stage: "new_lead", rationale: "Baseline — no further activity recorded yet." };
  for (const entry of evidence) {
    if (entry.met && STAGE_RANK[entry.stage] >= STAGE_RANK[resolved.stage]) {
      resolved = entry;
    }
  }

  // Post-closed stages have no source-module field — only a recorded manual
  // transition can advance the journey past `closed`, and only when it is
  // itself more advanced than what the facts above already established.
  if (resolved.stage === "closed" && data.latestManualTransition && POST_CLOSED_STAGES.includes(data.latestManualTransition.newStage)) {
    return { ...base, stage: data.latestManualTransition.newStage, rationale: `Most recent recorded transition manually advanced the journey to '${data.latestManualTransition.newStage}'.` };
  }
  if (data.latestManualTransition?.type === "reopened" && !TERMINAL_JOURNEY_STAGES.includes(resolved.stage)) {
    return { ...base, stage: data.latestManualTransition.newStage, rationale: "Most recent recorded transition reopened the journey at an earlier stage." };
  }

  return { ...base, ...resolved };
}

"use server";

import { getCurrentClientAccountContext, getClientPortalOverview, getClientPortalContracts, getClientPortalInvoices, getClientPortalEvents, getClientPortalDocuments } from "@/lib/data";
import { getClientPortalJourneySummaryAction } from "@/modules/clientPortal/getClientPortalJourneySummary";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";
import { nowIso } from "@/lib/data/utils";
import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { DocumentCategory } from "@/core/enums/documentCategory";

/**
 * v2.0 Checkpoint 42, Step 13 — Client-Safe Reporting. A strict allowlist,
 * never a client-facing entry point into the internal Reporting Engine
 * (`core/reporting/computationEngine.ts`) — that engine's Metric Registry
 * carries internal-only metrics (staff utilization, margins, workspace
 * health composites) that must never reach a client, and the internal
 * `reports.*` permission matrix has no concept of a Client Portal session
 * in the first place. Gated by `getCurrentClientAccountContext()` — the
 * Client Portal's own session, never the internal `WorkspaceMemberRole`/
 * `Permission` system — the exact same boundary every other
 * `modules/clientPortal/get*.ts` accessor already enforces.
 *
 * Every field below composes an already-existing, already-reviewed
 * client-safe accessor (`lib/data/index.ts`'s "Client Portal" section, or
 * `modules/clientPortal/*.ts`) and re-projects only the named fields this
 * checkpoint's own spec calls out — journey progress, proposal/contract/
 * invoice status, payment schedule, event readiness, milestones, shared
 * document activity — never a raw `ClientPortal*` DTO passed through
 * whole, so a field added to one of those DTOs later is never silently
 * forwarded here.
 */

const GENERIC_ACCESS_ERROR = "The Report isn't available. Please sign in again.";

export interface ClientSafeJourneyProgress {
  currentStageLabel: string;
  progressPercentage: number;
  nextStepLabel: string | null;
}

export interface ClientSafeProposalStatus {
  id: string;
  title: string;
  sentAt: string | null;
}

export interface ClientSafeContractStatus {
  id: string;
  title: string;
  status: ContractStatus;
  signatureStatus: SignatureStatus;
  effectiveDate: string | null;
}

export interface ClientSafePaymentScheduleEntry {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  dueDate: string | null;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  currency: string;
}

export interface ClientSafeEventReadiness {
  id: string;
  title: string;
  eventDate: string | null;
  status: EventStatus;
  guestCount: number | null;
}

export interface ClientSafeDocumentActivity {
  id: string;
  title: string;
  category: DocumentCategory;
  uploadedAt: string;
}

export interface ClientSafeReport {
  clientName: string;
  journey: ClientSafeJourneyProgress;
  milestones: string[];
  proposals: ClientSafeProposalStatus[];
  contracts: ClientSafeContractStatus[];
  paymentSchedule: ClientSafePaymentScheduleEntry[];
  events: ClientSafeEventReadiness[];
  recentDocumentActivity: ClientSafeDocumentActivity[];
  generatedAt: string;
}

export type GetClientSafeReportResult = { success: true; data: ClientSafeReport } | { success: false; error: string };

/** The Client Portal's one Reporting surface — a single, read-only summary composed entirely from already-client-safe sources. Never accepts a metric/dimension/filter selection from the caller (that's the internal Report Builder's contract, not this one's). */
export async function getClientSafeReportAction(): Promise<GetClientSafeReportResult> {
  const context = await getCurrentClientAccountContext();
  if (!context) return { success: false, error: GENERIC_ACCESS_ERROR };

  const [journeyResult, proposalsResult, overview, contracts, invoices, events, documents] = await Promise.all([
    getClientPortalJourneySummaryAction(),
    listClientPortalProposalsAction(),
    getClientPortalOverview(),
    getClientPortalContracts(),
    getClientPortalInvoices(),
    getClientPortalEvents(),
    getClientPortalDocuments(),
  ]);

  if (!journeyResult.success) return { success: false, error: GENERIC_ACCESS_ERROR };

  return {
    success: true,
    data: {
      clientName: overview.clientName,
      journey: {
        currentStageLabel: journeyResult.data.currentStageLabel,
        progressPercentage: journeyResult.data.progressPercentage,
        nextStepLabel: journeyResult.data.nextStepLabel,
      },
      milestones: journeyResult.data.completedMilestoneLabels,
      proposals: proposalsResult.success ? proposalsResult.data.map((p) => ({ id: p.proposalId, title: p.title, sentAt: p.sentAt })) : [],
      contracts: contracts.map((c) => ({ id: c.id, title: c.title, status: c.status, signatureStatus: c.signature_status, effectiveDate: c.effective_date })),
      paymentSchedule: invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoice_number, status: i.status, dueDate: i.due_date, totalMinor: i.total_minor, paidMinor: i.paid_minor, balanceMinor: i.balance_minor, currency: i.currency })),
      events: events.map((e) => ({ id: e.id, title: e.title, eventDate: e.event_date, status: e.status, guestCount: e.guest_count })),
      recentDocumentActivity: documents.slice(0, 10).map((d) => ({ id: d.id, title: d.title, category: d.category, uploadedAt: d.uploaded_at })),
      generatedAt: nowIso(),
    },
  };
}

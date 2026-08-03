"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { getClientById, getContract, getInvoiceById, getInvoices } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";

import { getCoreInvoiceTemplatesService, getCoreInvoiceBuilderService } from "@/core/invoicePlatform";
import type { CreateCustomInvoiceTemplateInput } from "@/lib/data/mock/invoiceTemplatesStore";
import { buildInvoiceVersion, currentVersionOf, nextStatusAfterVersion } from "@/core/invoicePlatform/invoiceBuilderEngine";
import { computeInvoiceHealth } from "@/core/invoicePlatform/invoiceHealthEngine";
import { evaluateInvoiceReadiness } from "@/core/invoicePlatform/invoiceReadinessEngine";
import { compareInvoiceVersions } from "@/core/invoicePlatform/invoiceComparisonEngine";
import { computeInvoiceAnalytics, type InvoiceAnalyticsInput } from "@/core/invoicePlatform/invoiceAnalyticsEngine";
import { buildInvoiceClientRelationship, buildInvoiceContractRelationship, buildInvoiceProposalRelationship } from "@/core/invoicePlatform/invoiceKnowledgeGraphEngine";
import { invoiceHealthToRecommendations } from "@/core/invoicePlatform/invoiceExecutiveIntegration";
import { getCached, setCached, invalidateInvoiceCache } from "@/core/invoicePlatform/invoiceCache";

import type {
  InvoiceTemplate,
  InvoiceBuilderState,
  InvoiceDetail,
  InvoiceSummary,
  InvoiceComparisonResult,
  InvoiceAnalyticsSnapshot,
  CreateInvoiceVersionInput,
} from "@/types/invoicePlatform";
import type { Invoice } from "@/types/invoice";
import type { OperationalRecommendation } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "The Invoice Platform isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This invoice could not be found.";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Source data gathering + the exported, reusable read model builder.
// ---------------------------------------------------------------------------

interface ResolvedProposalLink {
  hasLinkedProposal: boolean;
  linkedProposalId: string | null;
}

/** The one indirect link this checkpoint resolves — via the invoice's own `event_id`, since no direct Proposal FK exists on `Invoice`, the same pattern `resolveProposalLink` established for Contract Platform (Checkpoint 34). */
async function resolveProposalLink(eventId: string | null): Promise<ResolvedProposalLink> {
  if (!eventId) return { hasLinkedProposal: false, linkedProposalId: null };
  const proposal = await getProposalsRepository().getLatestProposalForEvent(eventId).catch(() => null);
  if (!proposal) return { hasLinkedProposal: false, linkedProposalId: null };
  return { hasLinkedProposal: true, linkedProposalId: proposal.id };
}

/** Unlike the Proposal link, `contract_id` is a direct FK on the real `Invoice` — this only confirms the linked Contract record still exists. */
async function resolveContractLink(contractId: string | null): Promise<{ hasLinkedContract: boolean }> {
  if (!contractId) return { hasLinkedContract: false };
  const contract = await getContract(contractId).catch(() => null);
  return { hasLinkedContract: contract !== null };
}

/** Exported so a future Client Portal Billing Experience can reuse this exact builder without going through the team-member session gate — the same `buildContractDetail` precedent Checkpoint 34 established. */
export async function buildInvoiceDetail(workspaceId: string, invoiceId: string): Promise<InvoiceDetail | null> {
  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== workspaceId) return null;

  const [client, builderState, proposalLink, contractLink] = await Promise.all([
    getClientById(invoice.client_id).catch(() => null),
    getCoreInvoiceBuilderService().getByInvoiceId(invoiceId),
    resolveProposalLink(invoice.event_id),
    resolveContractLink(invoice.contract_id),
  ]);

  const currentVersion = builderState ? currentVersionOf(builderState) : null;

  const health = computeInvoiceHealth({
    builderState,
    currentVersion,
    hasClient: client !== null,
    hasLinkedProposal: proposalLink.hasLinkedProposal,
    hasLinkedContract: contractLink.hasLinkedContract,
    invoiceIssueDate: invoice.issue_date,
    invoiceDueDate: invoice.due_date,
    evaluatedAt: nowIso(),
  });

  const readiness = evaluateInvoiceReadiness({
    currentVersion,
    hasClient: client !== null,
    hasLinkedProposal: proposalLink.hasLinkedProposal,
    hasLinkedContract: contractLink.hasLinkedContract,
    health,
  });

  return { invoice, builderState, currentVersion, health, readiness };
}

function toSummary(detail: InvoiceDetail): InvoiceSummary {
  return {
    invoiceId: detail.invoice.id,
    clientId: detail.invoice.client_id,
    eventId: detail.invoice.event_id,
    contractId: detail.invoice.contract_id,
    documentStatus: detail.builderState?.status ?? "draft",
    invoiceStatus: detail.invoice.status,
    currentVersionNumber: detail.currentVersion?.version_number ?? null,
    templateKey: detail.currentVersion?.snapshot.templateKey ?? null,
    grandTotal_minor: detail.currentVersion?.snapshot.pricing.grandTotal_minor ?? null,
    currency: detail.currentVersion?.snapshot.pricing.currency ?? detail.invoice.currency,
    overallHealthScore: detail.health.overallScore,
    readinessState: detail.readiness.state,
    readyAt: detail.builderState?.ready_at ?? null,
    createdAt: detail.invoice.created_at,
    updatedAt: detail.builderState?.updated_at ?? detail.invoice.updated_at,
  };
}

async function persistInvoiceRelationships(workspaceId: string, actor: string, invoiceId: string, clientId: string, contractId: string | null, linkedProposalId: string | null): Promise<void> {
  const specs = [buildInvoiceClientRelationship(invoiceId, clientId), ...buildInvoiceContractRelationship(invoiceId, contractId), ...buildInvoiceProposalRelationship(invoiceId, linkedProposalId)];
  for (const spec of specs) {
    await getCoreKnowledgeGraphService().createRelationship(workspaceId, actor, {
      sourceNodeType: spec.sourceNode.nodeType,
      sourceNodeId: spec.sourceNode.nodeId,
      targetNodeType: spec.targetNode.nodeType,
      targetNodeId: spec.targetNode.nodeId,
      relationshipType: spec.relationshipType,
      source: "user_action",
    });
  }
}

// ---------------------------------------------------------------------------
// Template Library (Step 2)
// ---------------------------------------------------------------------------

export async function listInvoiceTemplatesAction(): Promise<ActionResult<InvoiceTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreInvoiceTemplatesService().listTemplates(session.workspace.id) };
}

export async function createCustomInvoiceTemplateAction(input: CreateCustomInvoiceTemplateInput): Promise<ActionResult<InvoiceTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_templates.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = await getCoreInvoiceTemplatesService().createCustomTemplate(session.workspace.id, session.membership.id, input);
  return { success: true, data: template };
}

// ---------------------------------------------------------------------------
// Evaluate / list
// ---------------------------------------------------------------------------

export async function evaluateInvoiceAction(invoiceId: string): Promise<ActionResult<InvoiceDetail>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const detail = await buildInvoiceDetail(session.workspace.id, invoiceId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: detail };
}

export async function listInvoiceSummariesAction(): Promise<ActionResult<InvoiceSummary[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:summaries`;
  const cached = getCached<InvoiceSummary[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const invoices = await getInvoices({ includeArchived: true }).catch(() => [] as Invoice[]);
  const details = await Promise.all(invoices.map((i) => buildInvoiceDetail(session.workspace.id, i.id)));
  const summaries = details.filter((d): d is NonNullable<typeof d> => d !== null).map(toSummary);

  setCached(cacheKey, summaries);
  return { success: true, data: summaries };
}

// ---------------------------------------------------------------------------
// Versioning (Step 8) + Comparison (Step 9)
// ---------------------------------------------------------------------------

export async function createInvoiceVersionAction(invoiceId: string, input: CreateInvoiceVersionInput): Promise<ActionResult<InvoiceBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const proposalLink = await resolveProposalLink(invoice.event_id);

  const existing = await getCoreInvoiceBuilderService().getOrCreateForInvoice(session.workspace.id, invoiceId, session.membership.id);
  const isFirstVersion = existing.versions.length === 0;
  const version = buildInvoiceVersion(invoiceId, session.workspace.id, existing.versions, { createInput: input, currency: invoice.currency, paidToDate_minor: invoice.paid_minor }, session.membership.id);
  const nextStatus = nextStatusAfterVersion(existing.status, isFirstVersion);

  const updated = await getCoreInvoiceBuilderService().appendVersion(invoiceId, version, nextStatus);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_version_created", `Version ${version.version_number} created`, { eventId: invoice.event_id, clientId: invoice.client_id });
  await persistInvoiceRelationships(session.workspace.id, session.membership.id, invoiceId, invoice.client_id, invoice.contract_id, proposalLink.linkedProposalId);

  if (isFirstVersion) {
    if (proposalLink.linkedProposalId) {
      recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_linked_to_proposal", "Invoice linked to proposal", { eventId: invoice.event_id, clientId: invoice.client_id });
    }
    if (invoice.contract_id) {
      recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_linked_to_contract", "Invoice linked to contract", { eventId: invoice.event_id, clientId: invoice.client_id });
    }
  }

  if (version.snapshot.paymentSchedule.length > 0) {
    recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_installments_scheduled", "Invoice installment schedule set", { eventId: invoice.event_id, clientId: invoice.client_id });
  }
  if (version.snapshot.adjustments.some((a) => a.kind === "credit" || a.kind === "service_credit" || a.kind === "invoice_credit")) {
    recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_credit_applied", "Invoice credit applied", { eventId: invoice.event_id, clientId: invoice.client_id });
  }

  invalidateInvoiceCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function publishInvoiceVersionAction(invoiceId: string): Promise<ActionResult<InvoiceBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreInvoiceBuilderService().setStatus(invoiceId, "published");
  if (!updated) return { success: false, error: "This invoice has no document to publish yet." };

  recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_published", "Invoice document published", { eventId: invoice.event_id, clientId: invoice.client_id });
  invalidateInvoiceCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function archiveInvoiceDocumentAction(invoiceId: string): Promise<ActionResult<InvoiceBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreInvoiceBuilderService().setStatus(invoiceId, "archived");
  if (!updated) return { success: false, error: "This invoice has no document to archive yet." };

  recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_archived", "Invoice document archived", { eventId: invoice.event_id, clientId: invoice.client_id });
  invalidateInvoiceCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function restoreInvoiceVersionAction(invoiceId: string, versionId: string): Promise<ActionResult<InvoiceBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreInvoiceBuilderService().restoreVersion(invoiceId, versionId);
  if (!updated) return { success: false, error: "That version could not be found." };

  const restoredVersion = updated.versions.find((v) => v.id === versionId);
  recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_restored", `Restored version ${restoredVersion?.version_number ?? ""}`.trim(), { eventId: invoice.event_id, clientId: invoice.client_id });
  invalidateInvoiceCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function compareInvoiceVersionsAction(invoiceId: string, versionANumber: number, versionBNumber: number): Promise<ActionResult<InvoiceComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const invoice = await getInvoiceById(invoiceId).catch(() => null);
  if (!invoice || invoice.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const state = await getCoreInvoiceBuilderService().getByInvoiceId(invoiceId);
  if (!state) return { success: false, error: "This invoice has no version history yet." };

  const versionA = state.versions.find((v) => v.version_number === versionANumber);
  const versionB = state.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  const result = compareInvoiceVersions(versionA, versionB);
  recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_compared", `Compared version ${versionANumber} to version ${versionBNumber}`, { eventId: invoice.event_id, clientId: invoice.client_id });
  return { success: true, data: result };
}

// ---------------------------------------------------------------------------
// Readiness (Step 11 — the "Ready" Timeline event's origination point)
// ---------------------------------------------------------------------------

export async function markInvoiceReadyAction(invoiceId: string): Promise<ActionResult<InvoiceBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("invoice_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const detail = await buildInvoiceDetail(session.workspace.id, invoiceId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  if (detail.readiness.state !== "ready") return { success: false, error: detail.readiness.reasons[0] ?? "This invoice document isn't ready yet." };

  const wasAlreadyReady = detail.builderState?.ready_at != null;
  const updated = await getCoreInvoiceBuilderService().markReady(invoiceId);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  if (!wasAlreadyReady) {
    recordTimelineActivity(session.workspace.id, "invoice", invoiceId, "invoice_document_ready", "Invoice document marked ready", { eventId: detail.invoice.event_id, clientId: detail.invoice.client_id });
  }
  invalidateInvoiceCache(session.workspace.id);
  return { success: true, data: updated };
}

// ---------------------------------------------------------------------------
// Analytics (Step 13)
// ---------------------------------------------------------------------------

export async function getInvoiceAnalyticsAction(): Promise<ActionResult<InvoiceAnalyticsSnapshot>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:analytics`;
  const cached = getCached<InvoiceAnalyticsSnapshot>(cacheKey);
  if (cached) return { success: true, data: cached };

  const invoices = await getInvoices({ includeArchived: true }).catch(() => [] as Invoice[]);
  const builderStates = await getCoreInvoiceBuilderService().listForWorkspace(session.workspace.id);
  const byInvoiceId = new Map(builderStates.map((s) => [s.invoice_id, s]));
  const inputs: InvoiceAnalyticsInput[] = invoices.map((invoice) => ({ builderState: byInvoiceId.get(invoice.id) ?? null }));

  const analytics = computeInvoiceAnalytics(inputs, nowIso());
  setCached(cacheKey, analytics);
  return { success: true, data: analytics };
}

// ---------------------------------------------------------------------------
// Executive Decisions integration (Step 17) — zero-arg, [] on no session.
// ---------------------------------------------------------------------------

export async function invoiceRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const invoices = await getInvoices({ includeArchived: true }).catch(() => [] as Invoice[]);
  const details = await Promise.all(invoices.map((i) => buildInvoiceDetail(session.workspace.id, i.id)));

  const recommendations: OperationalRecommendation[] = [];
  for (const detail of details) {
    if (!detail) continue;
    recommendations.push(
      ...invoiceHealthToRecommendations({
        invoice: detail.invoice,
        readiness: detail.readiness,
        health: detail.health,
        documentStatus: detail.builderState?.status ?? null,
        pricing: detail.currentVersion?.snapshot.pricing ?? null,
      }),
    );
  }

  return recommendations;
}

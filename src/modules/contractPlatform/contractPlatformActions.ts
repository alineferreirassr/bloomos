"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { getClientById, getContract, getContracts, getEventById, getContractExhibitsByContractId, sendContract } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { listConnections } from "@/core/integrations/integrationManager";
import { resolveAccessToken } from "@/core/integrations/credentialManager";
import { DocuSignProvider } from "@/core/integrations/providers/docusign/docusignProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import { renderDocumentToPdf } from "@/core/documents/pdfRenderer";
import { getWorkspaceBranding } from "@/core/branding/getWorkspaceBranding";
import { applyBrandingToDocument } from "@/core/branding/applyBrandingToDocument";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { evaluateClientJourneyAction } from "@/modules/clientJourney/clientJourneyActions";
import { getCoreProposalBuilderService } from "@/core/proposalPlatform";
import { currentVersionOf as currentProposalVersionOf } from "@/core/proposalPlatform/proposalBuilderEngine";

import { getCoreContractBuilderTemplatesService, getCoreContractClausesService, getCoreContractBuilderService } from "@/core/contractPlatform";
import type { CreateCustomContractTemplateInput } from "@/lib/data/mock/contractBuilderTemplatesStore";
import type { CreateCustomClauseInput } from "@/lib/data/mock/contractClausesStore";
import { buildContractVersion, currentVersionOf, nextStatusAfterVersion } from "@/core/contractPlatform/contractBuilderEngine";
import { resolveContractVariables } from "@/core/contractPlatform/variableEngine";
import { computeContractHealth } from "@/core/contractPlatform/contractHealthEngine";
import { evaluateContractReadiness } from "@/core/contractPlatform/contractReadinessEngine";
import { compareContractVersions } from "@/core/contractPlatform/contractComparisonEngine";
import { computeContractAnalytics, type ContractAnalyticsInput } from "@/core/contractPlatform/contractAnalyticsEngine";
import { buildContractDocumentRelationships, buildContractProposalRelationship } from "@/core/contractPlatform/contractKnowledgeGraphEngine";
import { contractHealthToRecommendations, acceptedProposalMissingContractRecommendation } from "@/core/contractPlatform/contractExecutiveIntegration";
import { getCached, setCached, invalidateContractCache } from "@/core/contractPlatform/contractCache";

import type {
  ContractBuilderTemplate,
  ContractClause,
  ContractBuilderState,
  ContractDetail,
  ContractSummary,
  ContractComparisonResult,
  ContractAnalyticsSnapshot,
  ContractPricingReference,
  CreateContractVersionInput,
} from "@/types/contractPlatform";
import type { Contract } from "@/types/contract";
import type { OperationalRecommendation } from "@/types/businessHealth";
import type { DocumentBlock } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "The Contract Platform isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This contract could not be found.";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Source data gathering + the exported, reusable read model builder.
// ---------------------------------------------------------------------------

interface ResolvedProposalLink {
  pricingReference: ContractPricingReference | null;
  hasLinkedProposal: boolean;
  linkedProposalId: string | null;
}

/** Resolves the ONE indirect Proposal link this checkpoint supports — via the contract's own `event_id`, since no direct FK exists (see `types/contractPlatform.ts`). The Proposal Platform's own real, computed pricing (Checkpoint 33) is reused, never re-derived. */
async function resolveProposalLink(eventId: string | null): Promise<ResolvedProposalLink> {
  if (!eventId) return { pricingReference: null, hasLinkedProposal: false, linkedProposalId: null };

  const proposal = await getProposalsRepository().getLatestProposalForEvent(eventId).catch(() => null);
  if (!proposal) return { pricingReference: null, hasLinkedProposal: false, linkedProposalId: null };

  const builderState = await getCoreProposalBuilderService().getByProposalId(proposal.id);
  const version = builderState ? currentProposalVersionOf(builderState) : null;
  const pricing = version?.snapshot.pricing ?? null;

  const pricingReference: ContractPricingReference | null = pricing
    ? { proposalId: proposal.id, grandTotal_minor: pricing.grandTotal_minor, currency: pricing.currency, depositDue_minor: pricing.depositDue_minor, remainingBalance_minor: pricing.remainingBalance_minor }
    : null;

  return { pricingReference, hasLinkedProposal: true, linkedProposalId: proposal.id };
}

/** Exported so a future Client Portal Contract Experience can reuse this exact builder without going through the team-member session gate — the same `buildProposalDetail` precedent Checkpoint 33 established. */
export async function buildContractDetail(workspaceId: string, contractId: string): Promise<ContractDetail | null> {
  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== workspaceId) return null;

  const [client, builderState, proposalLink, journeyResult] = await Promise.all([
    getClientById(contract.client_id).catch(() => null),
    getCoreContractBuilderService().getByContractId(contractId),
    resolveProposalLink(contract.event_id),
    evaluateClientJourneyAction("client", contract.client_id).catch(() => null),
  ]);

  const currentVersion = builderState ? currentVersionOf(builderState) : null;
  const template = currentVersion?.snapshot.builderTemplateId ? await getCoreContractBuilderTemplatesService().getTemplateById(currentVersion.snapshot.builderTemplateId) : null;
  const requiredSectionKeys = template?.structure.sectionKeys ?? [];
  const requiredClauseKeys = template?.structure.defaultClauseKeys ?? [];
  // `snapshot.clauseIds` holds real `ContractClause.id`s — resolved to their semantic `.key` here, since `computeContractHealth`/`evaluateContractReadiness` compare against `requiredClauseKeys` (also semantic keys), never raw ids.
  const presentClauses = currentVersion ? await getCoreContractClausesService().getClausesByIds(currentVersion.snapshot.clauseIds) : [];
  const presentClauseKeys = presentClauses.map((c) => c.key);
  const hasLinkedJourney = journeyResult?.success ?? false;

  const health = computeContractHealth({
    builderState,
    currentVersion,
    hasClient: client !== null,
    requiredSectionKeys,
    requiredClauseKeys,
    presentClauseKeys,
    hasLinkedProposal: proposalLink.hasLinkedProposal,
    hasLinkedJourney,
    evaluatedAt: nowIso(),
  });

  const readiness = evaluateContractReadiness({
    currentVersion,
    documentStatus: builderState?.status ?? null,
    hasClient: client !== null,
    hasLinkedProposal: proposalLink.hasLinkedProposal,
    requiredSectionKeys,
    requiredClauseKeys,
    presentClauseKeys,
    health,
  });

  return { contract, builderState, currentVersion, health, readiness };
}

function toSummary(detail: ContractDetail): ContractSummary {
  return {
    contractId: detail.contract.id,
    clientId: detail.contract.client_id,
    eventId: detail.contract.event_id,
    documentStatus: detail.builderState?.status ?? "draft",
    contractStatus: detail.contract.status,
    currentVersionNumber: detail.currentVersion?.version_number ?? null,
    templateKey: detail.currentVersion?.snapshot.builderTemplateKey ?? null,
    totalValue_minor: detail.currentVersion?.snapshot.pricingReference?.grandTotal_minor ?? null,
    currency: detail.currentVersion?.snapshot.pricingReference?.currency ?? detail.contract.currency,
    overallHealthScore: detail.health.overallScore,
    readinessState: detail.readiness.state,
    readyAt: detail.builderState?.ready_at ?? null,
    createdAt: detail.contract.created_at,
    updatedAt: detail.builderState?.updated_at ?? detail.contract.updated_at,
  };
}

async function persistContractRelationships(workspaceId: string, actor: string, contractId: string, clientId: string, snapshot: Parameters<typeof buildContractDocumentRelationships>[2], linkedProposalId: string | null): Promise<void> {
  const specs = [...buildContractDocumentRelationships(contractId, clientId, snapshot), ...buildContractProposalRelationship(contractId, linkedProposalId)];
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
// Template / Clause libraries (Steps 2, 4)
// ---------------------------------------------------------------------------

export async function listContractBuilderTemplatesAction(): Promise<ActionResult<ContractBuilderTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreContractBuilderTemplatesService().listTemplates(session.workspace.id) };
}

export async function createCustomContractTemplateAction(input: CreateCustomContractTemplateInput): Promise<ActionResult<ContractBuilderTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_templates.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = await getCoreContractBuilderTemplatesService().createCustomTemplate(session.workspace.id, session.membership.id, input);
  return { success: true, data: template };
}

export async function listContractClausesAction(): Promise<ActionResult<ContractClause[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreContractClausesService().listClauses(session.workspace.id) };
}

export async function createCustomClauseAction(input: CreateCustomClauseInput): Promise<ActionResult<ContractClause>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_clauses.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const clause = await getCoreContractClausesService().createCustomClause(session.workspace.id, session.membership.id, input);
  return { success: true, data: clause };
}

// ---------------------------------------------------------------------------
// Evaluate / list
// ---------------------------------------------------------------------------

export async function evaluateContractAction(contractId: string): Promise<ActionResult<ContractDetail>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const detail = await buildContractDetail(session.workspace.id, contractId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: detail };
}

export async function listContractSummariesAction(): Promise<ActionResult<ContractSummary[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:summaries`;
  const cached = getCached<ContractSummary[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const contracts = await getContracts({ includeArchived: true }).catch(() => [] as Contract[]);
  const details = await Promise.all(contracts.map((c) => buildContractDetail(session.workspace.id, c.id)));
  const summaries = details.filter((d): d is NonNullable<typeof d> => d !== null).map(toSummary);

  setCached(cacheKey, summaries);
  return { success: true, data: summaries };
}

// ---------------------------------------------------------------------------
// Versioning (Step 6) + Comparison (Step 7)
// ---------------------------------------------------------------------------

export async function createContractVersionAction(contractId: string, input: CreateContractVersionInput): Promise<ActionResult<ContractBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const [client, event, exhibits, proposalLink] = await Promise.all([
    getClientById(contract.client_id).catch(() => null),
    contract.event_id ? getEventById(contract.event_id).catch(() => null) : Promise.resolve(null),
    getContractExhibitsByContractId(contractId).catch(() => []),
    resolveProposalLink(contract.event_id),
  ]);

  const variables = resolveContractVariables({ client, eventDate: event?.event_date ?? null, pricingReference: proposalLink.pricingReference, companyName: session.workspace.name });

  const existing = await getCoreContractBuilderService().getOrCreateForContract(session.workspace.id, contractId, session.membership.id);
  const isFirstVersion = existing.versions.length === 0;
  const version = buildContractVersion(
    contractId,
    session.workspace.id,
    existing.versions,
    { createInput: input, variables, pricingReference: proposalLink.pricingReference, attachmentIds: exhibits.map((e) => e.id) },
    session.membership.id,
  );
  const nextStatus = nextStatusAfterVersion(existing.status, isFirstVersion);

  const updated = await getCoreContractBuilderService().appendVersion(contractId, version, nextStatus);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_version_created", `Version ${version.version_number} created`, { eventId: contract.event_id, clientId: contract.client_id });
  await persistContractRelationships(session.workspace.id, session.membership.id, contractId, contract.client_id, version.snapshot, proposalLink.linkedProposalId);

  if (isFirstVersion) {
    if (proposalLink.linkedProposalId) {
      recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_linked_to_proposal", "Contract linked to proposal", { eventId: contract.event_id, clientId: contract.client_id });
    }
    const journeyResult = await evaluateClientJourneyAction("client", contract.client_id).catch(() => null);
    if (journeyResult?.success) {
      recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_linked_to_journey", "Contract linked to client journey", { eventId: contract.event_id, clientId: contract.client_id });
    }
  }

  invalidateContractCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function publishContractVersionAction(contractId: string): Promise<ActionResult<ContractBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreContractBuilderService().setStatus(contractId, "published");
  if (!updated) return { success: false, error: "This contract has no document to publish yet." };

  recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_published", "Contract document published", { eventId: contract.event_id, clientId: contract.client_id });
  invalidateContractCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function archiveContractDocumentAction(contractId: string): Promise<ActionResult<ContractBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreContractBuilderService().setStatus(contractId, "archived");
  if (!updated) return { success: false, error: "This contract has no document to archive yet." };

  recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_archived", "Contract document archived", { eventId: contract.event_id, clientId: contract.client_id });
  invalidateContractCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function restoreContractVersionAction(contractId: string, versionId: string): Promise<ActionResult<ContractBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreContractBuilderService().restoreVersion(contractId, versionId);
  if (!updated) return { success: false, error: "That version could not be found." };

  const restoredVersion = updated.versions.find((v) => v.id === versionId);
  recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_restored", `Restored version ${restoredVersion?.version_number ?? ""}`.trim(), { eventId: contract.event_id, clientId: contract.client_id });
  invalidateContractCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function compareContractVersionsAction(contractId: string, versionANumber: number, versionBNumber: number): Promise<ActionResult<ContractComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const state = await getCoreContractBuilderService().getByContractId(contractId);
  if (!state) return { success: false, error: "This contract has no version history yet." };

  const versionA = state.versions.find((v) => v.version_number === versionANumber);
  const versionB = state.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  const result = compareContractVersions(versionA, versionB);
  recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_compared", `Compared version ${versionANumber} to version ${versionBNumber}`, { eventId: contract.event_id, clientId: contract.client_id });
  return { success: true, data: result };
}

// ---------------------------------------------------------------------------
// Readiness (Step 9 — the "Ready" Timeline event's origination point)
// ---------------------------------------------------------------------------

export async function markContractReadyAction(contractId: string): Promise<ActionResult<ContractBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contract_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const detail = await buildContractDetail(session.workspace.id, contractId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  if (detail.readiness.state !== "ready") return { success: false, error: detail.readiness.reasons[0] ?? "This contract document isn't ready yet." };

  const wasAlreadyReady = detail.builderState?.ready_at != null;
  const updated = await getCoreContractBuilderService().markReady(contractId);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  if (!wasAlreadyReady) {
    recordTimelineActivity(session.workspace.id, "contract", contractId, "contract_document_ready", "Contract document marked ready", { eventId: detail.contract.event_id, clientId: detail.contract.client_id });
  }
  invalidateContractCache(session.workspace.id);
  return { success: true, data: updated };
}

// ---------------------------------------------------------------------------
// Electronic Signature (v2 Checkpoint 44, Step 9) — connects the real
// DocuSignProvider (Checkpoint 43) to the Contract Platform's own
// `signature_status` state machine. Reuses `sendContract()` (the existing
// `lib/data/contracts` transition — never a second status-flip path) for
// the actual `signature_status: "sent"` write and its own Timeline event;
// this action's only new responsibility is the real outbound DocuSign
// call and resolving the workspace's own connected DocuSign account,
// mirroring `modules/integrations/notificationDeliveryProviders.ts`'s own
// Gmail resolution pattern exactly. Builds the PDF sent to DocuSign from
// this Contract's own plain fields (title/description/notes) through the
// Shared PDF Renderer (Step 3) + WorkspaceBranding (Step 1) — the old
// Contract Variable Engine's own `ContractSnapshot.sections` stays
// untouched, per this checkpoint's own "don't migrate it" instruction.
// ---------------------------------------------------------------------------

function buildContractSigningDocument(contract: Contract): DocumentBlock[] {
  const blocks: DocumentBlock[] = [{ id: "title", type: "heading", level: 1, runs: [{ text: contract.title }] }];
  if (contract.description) blocks.push({ id: "description", type: "paragraph", runs: [{ text: contract.description }] });
  if (contract.notes) blocks.push({ id: "notes", type: "paragraph", runs: [{ text: contract.notes }] });
  return blocks;
}

export async function sendContractForSignatureAction(contractId: string): Promise<ActionResult<Contract>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("contracts.lifecycle")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const contract = await getContract(contractId).catch(() => null);
  if (!contract || contract.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };
  if (contract.signature_status !== "unsigned" && contract.signature_status !== "declined") {
    return { success: false, error: "This contract has already been sent for signature." };
  }

  const client = await getClientById(contract.client_id).catch(() => null);
  if (!client?.email) return { success: false, error: "This Client has no email on file to send for signature." };

  const connection = listConnections(session.workspace.id).find((c) => c.provider_id === "docusign" && c.state === "connected");
  if (!connection?.credential_id) return { success: false, error: "No connected DocuSign account for this workspace." };

  const accessToken = await resolveAccessToken(connection.credential_id);
  const accountId = connection.config.docusign_account_id;
  const accountBaseUri = connection.config.docusign_account_base_uri;
  if (!accessToken || typeof accountId !== "string" || typeof accountBaseUri !== "string") {
    return { success: false, error: "The DocuSign connection is missing required account details." };
  }

  const branding = await getWorkspaceBranding(session.workspace.id);
  const brandTheme = applyBrandingToDocument(branding);
  const pdfBytes = await renderDocumentToPdf(buildContractSigningDocument(contract), { documentTitle: contract.title, brandTheme, mode: "print" });
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email;

  try {
    const provider = new DocuSignProvider(accessToken, accountId, accountBaseUri);
    await provider.createSignatureRequest({
      documentName: `${contract.title}.pdf`,
      documentContent: new Blob([Buffer.from(pdfBytes)], { type: "application/pdf" }),
      signers: [{ name: clientName, email: client.email }],
    });
  } catch (error) {
    const record = sanitizeIntegrationError({ connectionId: connection.id, providerId: "docusign", rawMessage: error instanceof Error ? error.message : "Unknown DocuSign delivery error" });
    insertErrorRecord(record);
    return { success: false, error: record.message };
  }

  const result = await sendContract(contractId);
  if (result.success) invalidateContractCache(session.workspace.id);
  return result;
}

// ---------------------------------------------------------------------------
// Analytics (Step 11)
// ---------------------------------------------------------------------------

export async function getContractAnalyticsAction(): Promise<ActionResult<ContractAnalyticsSnapshot>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:analytics`;
  const cached = getCached<ContractAnalyticsSnapshot>(cacheKey);
  if (cached) return { success: true, data: cached };

  const contracts = await getContracts({ includeArchived: true }).catch(() => [] as Contract[]);
  const builderStates = await getCoreContractBuilderService().listForWorkspace(session.workspace.id);
  const byContractId = new Map(builderStates.map((s) => [s.contract_id, s]));
  const inputs: ContractAnalyticsInput[] = contracts.map((contract) => ({ contract, builderState: byContractId.get(contract.id) ?? null }));

  const analytics = computeContractAnalytics(inputs, nowIso());
  setCached(cacheKey, analytics);
  return { success: true, data: analytics };
}

// ---------------------------------------------------------------------------
// Executive Decisions integration (Step 15) — zero-arg, [] on no session.
// ---------------------------------------------------------------------------

export async function contractRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const contracts = await getContracts({ includeArchived: true }).catch(() => [] as Contract[]);
  const now = nowIso();
  const details = await Promise.all(contracts.map((c) => buildContractDetail(session.workspace.id, c.id)));

  const recommendations: OperationalRecommendation[] = [];
  for (const detail of details) {
    if (!detail) continue;
    recommendations.push(
      ...contractHealthToRecommendations({
        contract: detail.contract,
        readiness: detail.readiness,
        health: detail.health,
        documentStatus: detail.builderState?.status ?? null,
        updatedAt: detail.builderState?.updated_at ?? null,
        now,
      }),
    );
  }

  // The 6th named rule — cross-workspace, evaluated against ACCEPTED Proposals rather than Contracts.
  const proposals = await getProposalsRepository().getRecentProposals(session.workspace.id, 500).catch(() => []);
  const contractByEventId = new Map(contracts.map((c) => [c.event_id, c] as const));
  for (const proposal of proposals) {
    if (proposal.status !== "accepted") continue;
    const relatedContract = contractByEventId.get(proposal.event_id);
    const builderState = relatedContract ? await getCoreContractBuilderService().getByContractId(relatedContract.id) : null;
    const hasContractDocument = (builderState?.versions.length ?? 0) > 0;
    const rec = acceptedProposalMissingContractRecommendation(proposal.id, proposal.status, hasContractDocument);
    if (rec) recommendations.push(rec);
  }

  return recommendations;
}

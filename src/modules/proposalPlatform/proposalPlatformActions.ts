"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { getClientById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { evaluateClientJourneyAction } from "@/modules/clientJourney/clientJourneyActions";

import {
  getCoreProposalTemplatesService,
  getCoreProposalPackagesService,
  getCoreProposalAddonsService,
  getCoreProposalBuilderService,
} from "@/core/proposalPlatform";
import type { CreateCustomTemplateInput } from "@/lib/data/mock/proposalTemplatesStore";
import type { CreateCustomPackageInput } from "@/lib/data/mock/proposalPackagesStore";
import type { CreateCustomAddonInput } from "@/lib/data/mock/proposalAddonsStore";
import { buildProposalVersion, currentVersionOf, nextStatusAfterVersion } from "@/core/proposalPlatform/proposalBuilderEngine";
import { computeProposalHealth } from "@/core/proposalPlatform/proposalHealthEngine";
import { evaluateProposalReadiness } from "@/core/proposalPlatform/proposalReadinessEngine";
import { compareProposalVersions } from "@/core/proposalPlatform/proposalComparisonEngine";
import { computeProposalAnalytics, type ProposalAnalyticsInput } from "@/core/proposalPlatform/proposalAnalyticsEngine";
import { buildProposalDocumentRelationships } from "@/core/proposalPlatform/proposalKnowledgeGraphEngine";
import { proposalHealthToRecommendations } from "@/core/proposalPlatform/proposalExecutiveIntegration";
import { getCached, setCached, invalidateProposalCache } from "@/core/proposalPlatform/proposalCache";

import type {
  ProposalTemplate,
  ProposalPackage,
  ProposalAddon,
  ProposalBuilderState,
  ProposalVersion,
  ProposalDetail,
  ProposalSummary,
  ProposalComparisonResult,
  ProposalAnalyticsSnapshot,
  CreateProposalVersionInput,
} from "@/types/proposalPlatform";
import type { OperationalRecommendation } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "The Proposal Platform isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This proposal could not be found.";
const REQUIRED_SECTION_KEYS = new Set(["whats_included", "payment_schedule", "terms"]);

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Source data gathering + the exported, reusable read model builder.
// ---------------------------------------------------------------------------

async function requiredSectionKeysFor(templateId: string | null): Promise<string[]> {
  if (!templateId) return [];
  const template = await getCoreProposalTemplatesService().getTemplateById(templateId);
  if (!template) return [];
  return template.structure.sectionKeys.filter((k) => REQUIRED_SECTION_KEYS.has(k));
}

/**
 * Exported (not just used internally) specifically so the Client Portal's
 * own `getClientPortalProposal.ts` can reuse this exact builder without
 * going through the team-member session gate — the same `buildClientJourney`
 * precedent Checkpoint 32 established.
 */
export async function buildProposalDetail(workspaceId: string, proposalId: string): Promise<ProposalDetail | null> {
  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== workspaceId) return null;

  const [client, builderState] = await Promise.all([getClientById(proposal.client_id).catch(() => null), getCoreProposalBuilderService().getByProposalId(proposalId)]);
  const currentVersion = builderState ? currentVersionOf(builderState) : null;
  const requiredSectionKeys = await requiredSectionKeysFor(currentVersion?.snapshot.template_id ?? null);

  // v2.0 Checkpoint 34, Step 8 — wires this checkpoint's own previously-disclosed
  // gap: `journey_readiness` now reuses an already-computed Client Journey
  // health score instead of always resolving `null`. `evaluateClientJourneyAction`
  // resolves its own team-member session independently — a failure there
  // (no session, no journey yet, etc.) degrades to "not applicable," it never
  // fails Proposal evaluation itself.
  const journeyResult = await evaluateClientJourneyAction("client", proposal.client_id).catch(() => null);
  const journeyReadinessScore = journeyResult?.success ? journeyResult.data.health.overallJourneyHealth : null;

  const health = computeProposalHealth({
    proposal,
    builderState,
    currentVersion,
    hasClient: client !== null,
    requiredSectionKeys,
    journeyReadinessScore,
    evaluatedAt: nowIso(),
  });

  const readiness = evaluateProposalReadiness({ proposal, currentVersion, hasClient: client !== null, requiredSectionKeys, health });

  return { proposal, builderState, currentVersion, health, readiness };
}

function toSummary(detail: ProposalDetail): ProposalSummary {
  return {
    proposalId: detail.proposal.id,
    eventId: detail.proposal.event_id,
    clientId: detail.proposal.client_id,
    documentStatus: detail.builderState?.status ?? "draft",
    proposalStatus: detail.proposal.status,
    currentVersionNumber: detail.currentVersion?.version_number ?? null,
    templateKey: detail.currentVersion?.snapshot.templateKey ?? null,
    grandTotal_minor: detail.currentVersion?.snapshot.pricing.grandTotal_minor ?? null,
    currency: detail.currentVersion?.snapshot.pricing.currency ?? null,
    overallHealthScore: detail.health.overallScore,
    readinessState: detail.readiness.state,
    sentAt: detail.builderState?.sent_at ?? null,
    viewedAt: detail.builderState?.viewed_at ?? null,
    createdAt: detail.proposal.created_at,
    updatedAt: detail.builderState?.updated_at ?? detail.proposal.updated_at,
  };
}

async function persistProposalRelationships(workspaceId: string, actor: string, proposalId: string, clientId: string, snapshot: ProposalVersion["snapshot"] | null): Promise<void> {
  const specs = buildProposalDocumentRelationships(proposalId, clientId, snapshot);
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
// Template / Package / Add-on libraries (Steps 2, 6, 7)
// ---------------------------------------------------------------------------

export async function listProposalTemplatesAction(): Promise<ActionResult<ProposalTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreProposalTemplatesService().listTemplates(session.workspace.id) };
}

export async function createCustomTemplateAction(input: CreateCustomTemplateInput): Promise<ActionResult<ProposalTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_templates.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = await getCoreProposalTemplatesService().createCustomTemplate(session.workspace.id, session.membership.id, input);
  return { success: true, data: template };
}

export async function listProposalPackagesAction(): Promise<ActionResult<ProposalPackage[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreProposalPackagesService().listPackages(session.workspace.id) };
}

export async function createCustomPackageAction(input: CreateCustomPackageInput): Promise<ActionResult<ProposalPackage>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_packages.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const pkg = await getCoreProposalPackagesService().createCustomPackage(session.workspace.id, session.membership.id, input);
  return { success: true, data: pkg };
}

export async function listProposalAddonsAction(): Promise<ActionResult<ProposalAddon[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await getCoreProposalAddonsService().listAddons(session.workspace.id) };
}

export async function createCustomAddonAction(input: CreateCustomAddonInput): Promise<ActionResult<ProposalAddon>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_addons.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const addon = await getCoreProposalAddonsService().createCustomAddon(session.workspace.id, session.membership.id, input);
  return { success: true, data: addon };
}

// ---------------------------------------------------------------------------
// Evaluate / list (Steps 18-19)
// ---------------------------------------------------------------------------

export async function evaluateProposalAction(proposalId: string): Promise<ActionResult<ProposalDetail>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const detail = await buildProposalDetail(session.workspace.id, proposalId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: detail };
}

export async function listProposalSummariesAction(): Promise<ActionResult<ProposalSummary[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:summaries`;
  const cached = getCached<ProposalSummary[]>(cacheKey);
  if (cached) return { success: true, data: cached };

  const proposals = await getProposalsRepository().getRecentProposals(session.workspace.id, 500);
  const details = await Promise.all(proposals.map((p) => buildProposalDetail(session.workspace.id, p.id)));
  const summaries = details.filter((d): d is NonNullable<typeof d> => d !== null).map(toSummary);

  setCached(cacheKey, summaries);
  return { success: true, data: summaries };
}

// ---------------------------------------------------------------------------
// Versioning (Step 8) + Comparison (Step 9)
// ---------------------------------------------------------------------------

export async function createProposalVersionAction(proposalId: string, input: CreateProposalVersionInput): Promise<ActionResult<ProposalBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const existing = await getCoreProposalBuilderService().getOrCreateForProposal(session.workspace.id, proposalId, session.membership.id);
  const isFirstVersion = existing.versions.length === 0;
  const version = buildProposalVersion(proposalId, session.workspace.id, existing.versions, input, session.membership.id);
  const nextStatus = nextStatusAfterVersion(existing.status, isFirstVersion);

  const updated = await getCoreProposalBuilderService().appendVersion(proposalId, version, nextStatus);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_version_created", `Version ${version.version_number} created`, { eventId: proposal.event_id, clientId: proposal.client_id });
  await persistProposalRelationships(session.workspace.id, session.membership.id, proposalId, proposal.client_id, version.snapshot);
  invalidateProposalCache(session.workspace.id);

  return { success: true, data: updated };
}

export async function publishProposalVersionAction(proposalId: string): Promise<ActionResult<ProposalBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().setStatus(proposalId, "published");
  if (!updated) return { success: false, error: "This proposal has no document to publish yet." };

  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_document_published", "Proposal published", { eventId: proposal.event_id, clientId: proposal.client_id });
  invalidateProposalCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function archiveProposalAction(proposalId: string): Promise<ActionResult<ProposalBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().setStatus(proposalId, "archived");
  if (!updated) return { success: false, error: "This proposal has no document to archive yet." };

  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_document_archived", "Proposal archived", { eventId: proposal.event_id, clientId: proposal.client_id });
  invalidateProposalCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function restoreProposalVersionAction(proposalId: string, versionId: string): Promise<ActionResult<ProposalBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_versions.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const updated = await getCoreProposalBuilderService().restoreVersion(proposalId, versionId);
  if (!updated) return { success: false, error: "That version could not be found." };

  const restoredVersion = updated.versions.find((v) => v.id === versionId);
  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_document_restored", `Restored version ${restoredVersion?.version_number ?? ""}`.trim(), { eventId: proposal.event_id, clientId: proposal.client_id });
  invalidateProposalCache(session.workspace.id);
  return { success: true, data: updated };
}

export async function compareProposalVersionsAction(proposalId: string, versionANumber: number, versionBNumber: number): Promise<ActionResult<ProposalComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const proposal = await getProposalsRepository().getProposalById(proposalId);
  if (!proposal || proposal.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const state = await getCoreProposalBuilderService().getByProposalId(proposalId);
  if (!state) return { success: false, error: "This proposal has no version history yet." };

  const versionA = state.versions.find((v) => v.version_number === versionANumber);
  const versionB = state.versions.find((v) => v.version_number === versionBNumber);
  if (!versionA || !versionB) return { success: false, error: "One or both versions could not be found." };

  const result = compareProposalVersions(versionA, versionB);
  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_document_compared", `Compared version ${versionANumber} to version ${versionBNumber}`, { eventId: proposal.event_id, clientId: proposal.client_id });
  return { success: true, data: result };
}

// ---------------------------------------------------------------------------
// Send (Step 14 origination point — the real trigger Checkpoint 32 deferred)
// ---------------------------------------------------------------------------

export async function sendProposalAction(proposalId: string): Promise<ActionResult<ProposalBuilderState>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("proposal_builder.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const detail = await buildProposalDetail(session.workspace.id, proposalId);
  if (!detail) return { success: false, error: NOT_FOUND_ERROR };
  if (!detail.readiness.canSend) return { success: false, error: detail.readiness.reasons[0] ?? "This proposal isn't ready to send yet." };

  const updated = await getCoreProposalBuilderService().markSent(proposalId, session.membership.id);
  if (!updated) return { success: false, error: NOT_FOUND_ERROR };

  recordTimelineActivity(session.workspace.id, "proposal", proposalId, "proposal_document_sent", "Proposal sent to client", { eventId: detail.proposal.event_id, clientId: detail.proposal.client_id });
  invalidateProposalCache(session.workspace.id);
  return { success: true, data: updated };
}

// ---------------------------------------------------------------------------
// Analytics (Step 13)
// ---------------------------------------------------------------------------

export async function getProposalAnalyticsAction(): Promise<ActionResult<ProposalAnalyticsSnapshot>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const cacheKey = `${session.workspace.id}:analytics`;
  const cached = getCached<ProposalAnalyticsSnapshot>(cacheKey);
  if (cached) return { success: true, data: cached };

  const proposals = await getProposalsRepository().getRecentProposals(session.workspace.id, 500);
  const builderStates = await getCoreProposalBuilderService().listForWorkspace(session.workspace.id);
  const byProposalId = new Map(builderStates.map((s) => [s.proposal_id, s]));
  const inputs: ProposalAnalyticsInput[] = proposals.map((proposal) => ({ proposal, builderState: byProposalId.get(proposal.id) ?? null }));

  const analytics = computeProposalAnalytics(inputs, nowIso());
  setCached(cacheKey, analytics);
  return { success: true, data: analytics };
}

// ---------------------------------------------------------------------------
// Executive Decisions integration (Step 16) — zero-arg, [] on no session.
// ---------------------------------------------------------------------------

export async function proposalRecommendationsForExecutiveDecisions(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const proposals = await getProposalsRepository().getRecentProposals(session.workspace.id, 500);
  const now = nowIso();
  const details = await Promise.all(proposals.map((p) => buildProposalDetail(session.workspace.id, p.id)));

  const recommendations: OperationalRecommendation[] = [];
  for (const detail of details) {
    if (!detail) continue;
    recommendations.push(
      ...proposalHealthToRecommendations({
        proposal: detail.proposal,
        readiness: detail.readiness,
        health: detail.health,
        grandTotal_minor: detail.currentVersion?.snapshot.pricing.grandTotal_minor ?? null,
        documentStatus: detail.builderState?.status ?? "draft",
        sentAt: detail.builderState?.sent_at ?? null,
        updatedAt: detail.builderState?.updated_at ?? detail.proposal.updated_at,
        now,
      }),
    );
  }
  return recommendations;
}

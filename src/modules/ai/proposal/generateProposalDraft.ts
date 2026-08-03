"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";
import { mapSkillErrorToMessage } from "@/core/ai/skills/errorMapping";
import { getMemoryManager } from "@/core/ai/memory";
import { registerProposalSkill, PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { assembleProposalDraftInput } from "@/modules/ai/proposal/assembleProposalDraft";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { getProposalsRepository } from "@/lib/data/proposals";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { buildProposalVersionChainRelationships } from "@/core/proposalPlatform/proposalKnowledgeGraphEngine";
import type { ProposalContext, ProposalModelOutput } from "@/modules/ai/proposal/types";
import type { ProposalDraft } from "@/types/proposal";
import type { AIMemoryEntry } from "@/types/aiMemory";

const MEMORY_TITLE_MAX_LENGTH = 80;
const RELEVANT_MEMORIES_LIMIT = 5;

const GENERIC_ACCESS_ERROR = "This proposal isn't available. It may not exist, or you may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate a proposal right now. Please try again.";
const MALFORMED_OUTPUT_ERROR = "Bloom AI returned an unexpected response. Please try again.";
const SEMANTIC_FAILURE_ERROR = "Bloom AI's proposal draft didn't pass a consistency check. Please try again.";

// Registered once per process — idempotent, safe to call on every module load.
registerProposalSkill();
registerDefaultAIContextBuilders();

export type GenerateProposalDraftResult =
  | { success: true; data: ProposalDraft; relevantMemories: AIMemoryEntry[] }
  | { success: false; error: string };

/**
 * Checkpoint 6, Step 8: "surface relevant historical decisions, never
 * modify proposal content automatically." Deliberately a *separate*, direct
 * Memory Manager read — not threaded through the Skill's own context/prompt
 * pipeline at all — so there is no code path from a past memory to this
 * generation's actual output. Only ever `"approved"` memories are eligible
 * (a `"proposed"` suggestion hasn't been vetted by a human yet).
 */
async function fetchRelevantMemories(workspaceId: string, eventId: string, clientId: string): Promise<AIMemoryEntry[]> {
  const manager = getMemoryManager();
  const [eventMemories, clientMemories] = await Promise.all([
    manager.filterMemories(workspaceId, { entityType: "event", entityId: eventId, approvalStatus: "approved" }),
    manager.filterMemories(workspaceId, { entityType: "client", entityId: clientId, approvalStatus: "approved" }),
  ]);
  const byId = new Map([...eventMemories, ...clientMemories].map((memory) => [memory.id, memory]));
  return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RELEVANT_MEMORIES_LIMIT);
}

/**
 * The only entry point the UI ever calls for proposal generation —
 * everything from auth through persistence happens here, server-side.
 *
 * Checkpoint 4: this is now a thin wrapper around the generic Bloom AI
 * Skill pipeline (`executeSkill` → `runSkillCompletion`, see
 * `registerProposalSkill.ts`) rather than its own prompt/provider/parsing
 * plumbing — this feature's own contribution is only its early permission
 * check, its preliminary `clientId` lookup, and its post-processing
 * (suggested-memory proposal + persistence), never orchestration.
 *
 * Keeps its own early permission check (rather than deferring entirely to
 * `executeSkill`'s internal one) because a `clientId` must be resolved via
 * `fetchEventContextRecord` *before* the Skill can even be invoked (the
 * `client` context section needs it as a ref up front) — this file's own
 * test suite asserts `fetchEventContextRecord` is never called when
 * unauthorized, so the check has to happen first.
 *
 * A brand-new proposal passes `parentProposalId: null`; regenerating
 * passes the prior draft's id, which the repository uses to supersede it
 * and continue the same Event's version chain.
 */
export async function generateProposalDraft(eventId: string, parentProposalId: string | null = null): Promise<GenerateProposalDraftResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.update")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  let record;
  try {
    record = await fetchEventContextRecord(eventId);
  } catch {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }
  if (!record || !record.client) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  const clientId = record.client.id;

  const [result, relevantMemories] = await Promise.all([
    executeSkill({
      skillId: PROPOSAL_SKILL_ID,
      workspaceId: session.workspace.id,
      workspaceName: session.workspace.name,
      userId: session.user.id,
      userName: session.profile.full_name ?? undefined,
      permissions: session.permissions,
      role: session.membership.role,
      refs: { eventId, clientId },
    }),
    fetchRelevantMemories(session.workspace.id, eventId, clientId),
  ]);

  if (!result.success) {
    return {
      success: false,
      error: mapSkillErrorToMessage(result.error, {
        contextUnavailable: GENERIC_ACCESS_ERROR,
        provider: GENERIC_PROVIDER_ERROR,
        malformed: MALFORMED_OUTPUT_ERROR,
        semantic: SEMANTIC_FAILURE_ERROR,
      }),
    };
  }

  const context = result.context as ProposalContext;
  const data = result.data as ProposalModelOutput;

  if (data.suggestedMemory) {
    const { scope, content } = data.suggestedMemory;
    const title = content.length > MEMORY_TITLE_MAX_LENGTH ? `${content.slice(0, MEMORY_TITLE_MAX_LENGTH - 1)}…` : content;
    await getMemoryManager().proposeMemory(session.workspace.id, {
      skillId: result.metadata.useCaseId,
      entityType: "event",
      entityId: eventId,
      title,
      summary: content,
      visibility: scope,
      userId: scope === "user" ? session.user.id : undefined,
    });
  }

  const draftInput = assembleProposalDraftInput(data, context, eventId, clientId, parentProposalId, {
    provider: result.metadata.provider,
    model: result.metadata.model,
    promptVersion: result.metadata.promptVersion,
    mock: result.metadata.mock,
    latencyMs: result.metadata.latencyMs,
    generatedAt: result.metadata.generatedAt,
  });

  const created = await getProposalsRepository().createProposalDraft(session.workspace.id, draftInput);
  if (!created.success) {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }

  // v2.0 Checkpoint 32 — Client Journey Timeline.
  recordTimelineActivity(session.workspace.id, "proposal", created.data.id, "proposal_created", parentProposalId ? "Proposal regenerated" : "Proposal created", { eventId, clientId });

  // v2.0 Checkpoint 33 — Proposal Platform Knowledge Graph (Step 15): proposal_version_of/proposal_supersedes along the existing regeneration chain.
  for (const spec of buildProposalVersionChainRelationships(created.data.id, parentProposalId)) {
    await getCoreKnowledgeGraphService().createRelationship(session.workspace.id, session.membership.id, {
      sourceNodeType: spec.sourceNode.nodeType,
      sourceNodeId: spec.sourceNode.nodeId,
      targetNodeType: spec.targetNode.nodeType,
      targetNodeId: spec.targetNode.nodeId,
      relationshipType: spec.relationshipType,
      source: "user_action",
    });
  }

  return { success: true, data: created.data, relevantMemories };
}

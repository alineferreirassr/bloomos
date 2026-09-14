"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createAIGeneration,
  getAIGenerationById,
  listAIGenerations,
  approveAIGeneration,
  rejectAIGeneration,
  archiveAIGeneration,
  unarchiveAIGeneration,
  getIdeaItemById,
  getInspirationItemById,
  getScriptItemById,
} from "@/lib/data";
import { aiGenerationCreateSchema, aiGenerationListFiltersSchema } from "@/modules/aiGeneration/schema";
import type { AIGeneration, AIGenerationSourceEntityType } from "@/types/aiGeneration";

/**
 * SOCIAL-09B — the production data-access/action layer for AI Content
 * Intelligence's own durable generation-record domain. Repository +
 * persistence Server Actions only — no feature-specific generator (no Idea
 * generator, no Hook generator, no CTA generator, no Script improver; those
 * are explicitly deferred to a later checkpoint) and no call to any AI
 * provider anywhere in this file. Every action here assumes the caller
 * already has a *completed* generation result in hand (content a future
 * feature-specific action produced by calling the existing
 * `runSkillCompletion`/`executeAIRequest` pipeline) and only persists or
 * retrieves it.
 *
 * Mirrors `scriptActions.ts`'s own conventions exactly: its own local
 * `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR` (copied, not
 * imported — every domain action file in this codebase does this),
 * workspace id and actor id resolved entirely server-side from
 * `resolveMemberSessionSnapshot()`, never trusted from the browser.
 *
 * `social.publish` is never used anywhere in this file — reviewing a
 * generation (`approveAIGenerationAction`/`rejectAIGenerationAction`) is a
 * human sign-off on generated content, not publishing anything to a
 * connected provider, and SOCIAL-09A found no evidence any AI operation
 * requires that permission.
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const SOURCE_ENTITY_NOT_FOUND_ERROR = "That source item could not be found.";
const AI_GENERATION_NOT_FOUND_ERROR = "This AI generation could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";

type Result<T> = { success: true; data: T } | { success: false; error: string };

type ActiveSessionResult =
  | { success: false; error: string }
  | { success: true; session: Awaited<ReturnType<typeof resolveMemberSessionSnapshot>> & { kind: "active" } };

async function requireActiveSession(permission: "social.view" | "social.create"): Promise<ActiveSessionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes(permission)) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, session };
}

/**
 * The polymorphic-reference ownership check `source_entity_type`/
 * `source_entity_id` needs — dispatches to whichever domain's own
 * `getXById` the caller-supplied `sourceEntityType` names, then verifies
 * `workspace_id` matches, exactly like every single-type `loadOwned*`
 * helper elsewhere in this codebase (`loadOwnedScriptItem`,
 * `loadOwnedIdeaItem`). Never trusts `sourceEntityId` alone — this is the
 * only thing that proves a caller isn't pointing an AI generation at
 * another workspace's Idea/Inspiration/Script by guessing/reusing a
 * foreign id (mock mode has no RLS at all).
 */
async function verifyOwnedSourceEntity(sourceEntityType: AIGenerationSourceEntityType, sourceEntityId: string, workspaceId: string): Promise<boolean> {
  try {
    if (sourceEntityType === "idea_item") {
      const idea = await getIdeaItemById(sourceEntityId);
      return idea.workspace_id === workspaceId;
    }
    if (sourceEntityType === "inspiration_item") {
      const inspiration = await getInspirationItemById(sourceEntityId);
      return inspiration.workspace_id === workspaceId;
    }
    const script = await getScriptItemById(sourceEntityId);
    return script.workspace_id === workspaceId;
  } catch {
    return false;
  }
}

/** Mirrors `loadOwnedScriptItem`'s own shape for this table's own id. */
async function loadOwnedAIGeneration(id: string, workspaceId: string): Promise<AIGeneration | null> {
  const generation = await getAIGenerationById(id).catch(() => null);
  if (!generation || generation.workspace_id !== workspaceId) return null;
  return generation;
}

export interface CreateAIGenerationActionInput {
  source_entity_type: AIGenerationSourceEntityType;
  source_entity_id: string;
  use_case_id: string;
  skill_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  provider_id: string;
  model: string;
  prompt_version: string;
  is_mock: boolean;
  latency_ms: number;
  confidence: number | null;
}

/**
 * Persists one already-completed AI generation. Never mutates the source
 * Idea/Inspiration/Script — this only creates a new, independent row in
 * `ai_generations`, scoped to that source entity by reference only.
 */
export async function createAIGenerationAction(input: CreateAIGenerationActionInput): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = aiGenerationCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  const owned = await verifyOwnedSourceEntity(parsed.data.source_entity_type, parsed.data.source_entity_id, resolved.session.workspace.id);
  if (!owned) return { success: false, error: SOURCE_ENTITY_NOT_FOUND_ERROR };

  return createAIGeneration({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    sourceEntityType: parsed.data.source_entity_type,
    sourceEntityId: parsed.data.source_entity_id,
    useCaseId: parsed.data.use_case_id,
    skillId: parsed.data.skill_id,
    input: parsed.data.input,
    output: parsed.data.output,
    providerId: parsed.data.provider_id,
    model: parsed.data.model,
    promptVersion: parsed.data.prompt_version,
    isMock: parsed.data.is_mock,
    latencyMs: parsed.data.latency_ms,
    confidence: parsed.data.confidence,
  });
}

export async function getAIGenerationAction(id: string): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const generation = await loadOwnedAIGeneration(id, resolved.session.workspace.id);
  if (!generation) return { success: false, error: AI_GENERATION_NOT_FOUND_ERROR };
  return { success: true, data: generation };
}

export interface ListAIGenerationsActionFilters {
  source_entity_type?: AIGenerationSourceEntityType;
  source_entity_id?: string;
  use_case_id?: string;
  approval_status?: "proposed" | "approved" | "rejected";
  archived?: "active" | "archived" | "all";
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/** Never allow an unbounded read regardless of what a caller asks for — mirrors `clampLimit` in `scriptActions.ts`/`ideaActions.ts` exactly. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

/**
 * When `source_entity_type`/`source_entity_id` are both supplied, the
 * parent's own ownership is re-verified before ever listing — the
 * repository's own `listAIGenerations` filters only by `workspace_id` plus
 * whatever optional filters are given, with no cross-check of its own that
 * a caller-supplied `source_entity_id` actually belongs to the resolved
 * workspace beyond the plain `workspace_id` equality filter already
 * applied. Since `ai_generations` rows are always created under the
 * caller's own resolved workspace, this check exists specifically to
 * reject a probe for another workspace's Idea/Inspiration/Script id even
 * when it coincidentally has no rows to leak — a defense-in-depth match
 * for the same concern `listScriptVersionsAction` already addresses.
 */
export async function listAIGenerationsAction(filters: ListAIGenerationsActionFilters = {}): Promise<Result<AIGeneration[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const parsed = aiGenerationListFiltersSchema.safeParse(filters);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_entity_type && parsed.data.source_entity_id) {
    const owned = await verifyOwnedSourceEntity(parsed.data.source_entity_type, parsed.data.source_entity_id, resolved.session.workspace.id);
    if (!owned) return { success: false, error: SOURCE_ENTITY_NOT_FOUND_ERROR };
  }

  try {
    const generations = await listAIGenerations(resolved.session.workspace.id, {
      sourceEntityType: parsed.data.source_entity_type,
      sourceEntityId: parsed.data.source_entity_id,
      useCaseId: parsed.data.use_case_id,
      approvalStatus: parsed.data.approval_status,
      archived: parsed.data.archived,
      limit: clampLimit(parsed.data.limit),
    });
    return { success: true, data: generations };
  } catch {
    return { success: false, error: "Could not load AI generations." };
  }
}

/**
 * The human-in-the-loop boundary itself: an AI generation is never
 * self-approving (SOCIAL-09A Section C/H). This only ever changes
 * `ai_generations.approval_status`/`reviewed_by`/`reviewed_at` on the
 * generation record itself — it never touches the source Idea/Inspiration/
 * Script, never publishes a Social Post, and never transitions a
 * ScriptVersion to published.
 */
export async function approveAIGenerationAction(id: string): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedAIGeneration(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: AI_GENERATION_NOT_FOUND_ERROR };

  return approveAIGeneration(id, resolved.session.user.id);
}

export async function rejectAIGenerationAction(id: string): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedAIGeneration(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: AI_GENERATION_NOT_FOUND_ERROR };

  return rejectAIGeneration(id, resolved.session.user.id);
}

export async function archiveAIGenerationAction(id: string): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedAIGeneration(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: AI_GENERATION_NOT_FOUND_ERROR };

  return archiveAIGeneration(id);
}

export async function unarchiveAIGenerationAction(id: string): Promise<Result<AIGeneration>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedAIGeneration(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: AI_GENERATION_NOT_FOUND_ERROR };

  return unarchiveAIGeneration(id);
}

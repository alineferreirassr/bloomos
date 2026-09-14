"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createScriptItem,
  getScriptItemById,
  listScriptItems,
  updateScriptItem,
  archiveScriptItem,
  unarchiveScriptItem,
  createScriptVersion,
  getScriptVersionById,
  listScriptVersions,
  createScriptBlock,
  listScriptBlocks,
  updateScriptBlock,
  removeScriptBlock,
  getIdeaItemById,
} from "@/lib/data";
import { scriptItemInputSchema, scriptItemUpdateSchema, scriptBlockInputSchema, scriptBlockUpdateSchema } from "@/modules/script/schema";
import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { ScriptBlock } from "@/types/scriptBlock";
import type { ScriptArchivedFilter } from "@/lib/data/script/repository";

/**
 * SOCIAL-08C — the production data-access/action layer for Script Studio.
 * Repository + Server Actions only, no UI (SOCIAL-08D+ owns that) —
 * mirrors `ideaActions.ts`'s own conventions exactly: its own local
 * `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR` (copied, not
 * imported — every domain action file in this codebase does this),
 * workspace id and actor id resolved entirely server-side from
 * `resolveMemberSessionSnapshot()`, never trusted from the browser.
 *
 * `social.publish` is never used anywhere in this file — "publishing" a
 * ScriptVersion (draft → published) is a distinct future concept from
 * Social's own publish-to-Instagram permission and is not implemented in
 * this checkpoint at all (only create/get/list are authorized for
 * versions); see this checkpoint's own final report for that scope note.
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const SCRIPT_NOT_FOUND_ERROR = "This Script could not be found.";
const SCRIPT_VERSION_NOT_FOUND_ERROR = "This Script version could not be found.";
const SCRIPT_BLOCK_NOT_FOUND_ERROR = "This Script block could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";
/**
 * Matches the established, repeated precedent across every other
 * archive-capable domain checked (Workflows, Document Templates, Services,
 * Media Assets, Inspiration, Idea): editing an archived record is blocked,
 * not silently allowed — restore it first.
 */
const ARCHIVED_EDIT_ERROR = "An archived Script cannot be edited — restore it first.";

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

async function loadOwnedScriptItem(id: string, workspaceId: string): Promise<ScriptItem | null> {
  const item = await getScriptItemById(id).catch(() => null);
  if (!item || item.workspace_id !== workspaceId) return null;
  return item;
}

async function loadOwnedScriptVersion(id: string, workspaceId: string): Promise<ScriptVersion | null> {
  const version = await getScriptVersionById(id).catch(() => null);
  if (!version || version.workspace_id !== workspaceId) return null;
  return version;
}

type ReferenceValidationResult = { success: true } | { success: false; error: string };

/**
 * Ownership-only, same shape as Idea's own `validateOwnedInspirationReference`.
 * Never copies the referenced Idea's own content — this only proves the
 * caller is allowed to point at it. A Script's `source_idea_id` records
 * that an Idea triggered it, nothing more (SOCIAL-08A/08B's own design).
 */
async function validateOwnedIdeaReference(ideaId: string, workspaceId: string): Promise<ReferenceValidationResult> {
  const idea = await getIdeaItemById(ideaId).catch(() => null);
  if (!idea || idea.workspace_id !== workspaceId) return { success: false, error: "That Idea reference could not be found." };
  return { success: true };
}

export interface ScriptItemActionInput {
  title: string;
  source_idea_id: string | null;
}

export type ScriptItemActionUpdateInput = Partial<ScriptItemActionInput>;

export async function createScriptItemAction(input: ScriptItemActionInput): Promise<Result<ScriptItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = scriptItemInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_idea_id) {
    const ideaCheck = await validateOwnedIdeaReference(parsed.data.source_idea_id, resolved.session.workspace.id);
    if (!ideaCheck.success) return ideaCheck;
  }

  return createScriptItem({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    title: parsed.data.title,
    sourceIdeaId: parsed.data.source_idea_id,
  });
}

export async function updateScriptItemAction(id: string, input: ScriptItemActionUpdateInput): Promise<Result<ScriptItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedScriptItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };
  if (existing.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const parsed = scriptItemUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_idea_id) {
    const ideaCheck = await validateOwnedIdeaReference(parsed.data.source_idea_id, resolved.session.workspace.id);
    if (!ideaCheck.success) return ideaCheck;
  }

  return updateScriptItem(id, {
    title: parsed.data.title,
    sourceIdeaId: parsed.data.source_idea_id,
  });
}

export async function getScriptItemAction(id: string): Promise<Result<ScriptItem>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const item = await loadOwnedScriptItem(id, resolved.session.workspace.id);
  if (!item) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };
  return { success: true, data: item };
}

export interface ListScriptItemsActionFilters {
  archived?: ScriptArchivedFilter;
  search?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/** Never allow an unbounded read regardless of what a caller asks for — mirrors `clampLimit` in `ideaActions.ts` exactly. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export async function listScriptItemsAction(filters: ListScriptItemsActionFilters = {}): Promise<Result<ScriptItem[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  try {
    const items = await listScriptItems(resolved.session.workspace.id, {
      archived: filters.archived,
      search: filters.search,
      limit: clampLimit(filters.limit),
    });
    return { success: true, data: items };
  } catch {
    return { success: false, error: "Could not load Scripts." };
  }
}

export async function archiveScriptItemAction(id: string): Promise<Result<ScriptItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedScriptItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };

  return archiveScriptItem(id);
}

export async function unarchiveScriptItemAction(id: string): Promise<Result<ScriptItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedScriptItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };

  return unarchiveScriptItem(id);
}

/**
 * Creates the one mutable draft for this Script. Rejects if the Script
 * itself is archived (mirrors `updateScriptItemAction`'s own "restore it
 * first" rule — creating a new version is a form of editing the Script)
 * and rejects with a controlled duplicate-draft error if one already
 * exists (mirrors the DB's own `script_versions_one_draft_per_script`
 * partial unique index — never a raw Postgres constraint error).
 */
export async function createScriptVersionAction(scriptId: string): Promise<Result<ScriptVersion>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const script = await loadOwnedScriptItem(scriptId, resolved.session.workspace.id);
  if (!script) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };
  if (script.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  return createScriptVersion({
    scriptId,
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
  });
}

export async function getScriptVersionAction(id: string): Promise<Result<ScriptVersion>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const version = await loadOwnedScriptVersion(id, resolved.session.workspace.id);
  if (!version) return { success: false, error: SCRIPT_VERSION_NOT_FOUND_ERROR };
  return { success: true, data: version };
}

/**
 * Verifies the parent Script belongs to the caller's own workspace before
 * ever listing its versions — the repository's own `listScriptVersions`
 * filters only by `script_id`, with no workspace check of its own (in
 * Supabase mode, RLS is the backstop; in mock mode there is no RLS at all,
 * so this action-level check is the only thing preventing a caller from
 * listing another workspace's versions by guessing/reusing a foreign
 * `scriptId`).
 */
export async function listScriptVersionsAction(scriptId: string): Promise<Result<ScriptVersion[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const script = await loadOwnedScriptItem(scriptId, resolved.session.workspace.id);
  if (!script) return { success: false, error: SCRIPT_NOT_FOUND_ERROR };

  try {
    const versions = await listScriptVersions(scriptId);
    return { success: true, data: versions };
  } catch {
    return { success: false, error: "Could not load Script versions." };
  }
}

export interface ScriptBlockActionInput {
  content: string;
  sort_order: number;
}

export type ScriptBlockActionUpdateInput = Partial<ScriptBlockActionInput>;

/**
 * Verifies the target ScriptVersion belongs to the caller's own workspace
 * before creating a block under it — "garantir pertencimento ao
 * script_version correto," never trusting a caller-supplied
 * `scriptVersionId` alone.
 */
export async function createScriptBlockAction(scriptVersionId: string, input: ScriptBlockActionInput): Promise<Result<ScriptBlock>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const version = await loadOwnedScriptVersion(scriptVersionId, resolved.session.workspace.id);
  if (!version) return { success: false, error: SCRIPT_VERSION_NOT_FOUND_ERROR };

  const parsed = scriptBlockInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  return createScriptBlock({
    scriptVersionId,
    workspaceId: resolved.session.workspace.id,
    content: parsed.data.content,
    sortOrder: parsed.data.sort_order,
  });
}

/** Mirrors `listScriptVersionsAction`'s own defensive shape — the repository's `listScriptBlocks` filters only by `script_version_id`, so this action-level ownership check is what actually prevents cross-workspace access in mock mode. */
export async function listScriptBlocksAction(scriptVersionId: string): Promise<Result<ScriptBlock[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const version = await loadOwnedScriptVersion(scriptVersionId, resolved.session.workspace.id);
  if (!version) return { success: false, error: SCRIPT_VERSION_NOT_FOUND_ERROR };

  try {
    const blocks = await listScriptBlocks(scriptVersionId);
    return { success: true, data: blocks };
  } catch {
    return { success: false, error: "Could not load Script blocks." };
  }
}

/**
 * There is no single-block `getScriptBlockById` repository primitive (no
 * call site needed it besides this one and `removeScriptBlockAction`
 * below) — both re-derive the block via its own version's already-ordered
 * block list, which is workspace-checked one level up by the version
 * ownership check below.
 */
export async function updateScriptBlockAction(scriptVersionId: string, id: string, input: ScriptBlockActionUpdateInput): Promise<Result<ScriptBlock>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const version = await loadOwnedScriptVersion(scriptVersionId, resolved.session.workspace.id);
  if (!version) return { success: false, error: SCRIPT_VERSION_NOT_FOUND_ERROR };

  const blocks = await listScriptBlocks(scriptVersionId).catch(() => []);
  const existing = blocks.find((b) => b.id === id);
  if (!existing) return { success: false, error: SCRIPT_BLOCK_NOT_FOUND_ERROR };

  const parsed = scriptBlockUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  return updateScriptBlock(id, {
    content: parsed.data.content,
    sortOrder: parsed.data.sort_order,
  });
}

/**
 * SOCIAL-08D — the one real physical deletion in Script Studio, using the
 * DELETE policy added specifically for `script_blocks`
 * (`20260922100000_script_blocks_delete_policy.sql`). Verifies the target
 * version's ownership and the block's membership in that version before
 * ever calling the repository — never trusts `id` alone, and never allows
 * a block belonging to a different version (or a different workspace's
 * version) to be removed via this action.
 */
export async function removeScriptBlockAction(scriptVersionId: string, id: string): Promise<Result<null>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const version = await loadOwnedScriptVersion(scriptVersionId, resolved.session.workspace.id);
  if (!version) return { success: false, error: SCRIPT_VERSION_NOT_FOUND_ERROR };

  const blocks = await listScriptBlocks(scriptVersionId).catch(() => []);
  const existing = blocks.find((b) => b.id === id);
  if (!existing) return { success: false, error: SCRIPT_BLOCK_NOT_FOUND_ERROR };

  return removeScriptBlock(id);
}

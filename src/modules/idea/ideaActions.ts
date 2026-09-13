"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createIdeaItem,
  getIdeaItemById,
  listIdeaItems,
  updateIdeaItem,
  archiveIdeaItem,
  unarchiveIdeaItem,
  getInspirationItemById,
  getMediaAssetById,
  listMediaAssetsForWorkspace,
} from "@/lib/data";
import { ideaItemInputSchema, ideaItemUpdateSchema } from "@/modules/idea/schema";
import type { IdeaItem, IdeaPriority } from "@/types/ideaItem";
import type { InspirationContentFormat } from "@/types/inspirationItem";
import type { IdeaArchivedFilter } from "@/lib/data/idea/repository";
import type { MediaAsset } from "@/types/mediaAsset";

/**
 * SOCIAL-07C — the production data-access/action layer for the Ideas
 * Library. Repository + Server Actions only, no UI (SOCIAL-07D+ owns
 * that) — mirrors `inspirationActions.ts`'s own conventions exactly: its
 * own local `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR`
 * (copied, not imported — every Social/Inspiration action file does this),
 * workspace id and actor id resolved entirely server-side from
 * `resolveMemberSessionSnapshot()`, never trusted from the browser.
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This Idea could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";
/**
 * Matches the established, repeated precedent across every other
 * archive-capable domain checked (Workflows, Document Templates, Services,
 * Media Assets, and now Inspiration itself — SOCIAL-06E): editing an
 * archived record is blocked, not silently allowed — restore it first.
 * `updateIdeaItemAction` below already loads `existing` for ownership; this
 * reuses that same fetch.
 */
const ARCHIVED_EDIT_ERROR = "An archived Idea cannot be edited — restore it first.";

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

async function loadOwnedIdeaItem(id: string, workspaceId: string): Promise<IdeaItem | null> {
  const item = await getIdeaItemById(id).catch(() => null);
  if (!item || item.workspace_id !== workspaceId) return null;
  return item;
}

type ReferenceValidationResult = { success: true } | { success: false; error: string };

/**
 * Ownership-only — deliberately does NOT require an "approved" status,
 * mirroring `validateOwnedMediaAssetReference` in `inspirationActions.ts`
 * exactly (copied, not imported, matching that file's own established
 * per-domain-copy convention). The Ideas Library is a private planning
 * surface, not a publish pipeline.
 */
async function validateOwnedMediaAssetReference(assetId: string, workspaceId: string): Promise<ReferenceValidationResult> {
  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== workspaceId) return { success: false, error: "That file could not be found." };
  return { success: true };
}

/**
 * Ownership-only, same shape as `validateOwnedMediaAssetReference` above.
 * Never copies the referenced Inspiration's own content — this only proves
 * the caller is allowed to point at it. An Idea's `source_inspiration_id`
 * records that an Inspiration triggered it, nothing more (SOCIAL-07A/07B's
 * own design).
 */
async function validateOwnedInspirationReference(inspirationId: string, workspaceId: string): Promise<ReferenceValidationResult> {
  const inspiration = await getInspirationItemById(inspirationId).catch(() => null);
  if (!inspiration || inspiration.workspace_id !== workspaceId) return { success: false, error: "That Inspiration reference could not be found." };
  return { success: true };
}

export interface IdeaItemActionInput {
  title: string;
  description: string;
  source_inspiration_id: string | null;
  content_format: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  audience: string | null;
  notes: string | null;
  media_asset_id: string | null;
  priority: IdeaPriority | null;
}

export type IdeaItemActionUpdateInput = Partial<IdeaItemActionInput>;

export async function createIdeaItemAction(input: IdeaItemActionInput): Promise<Result<IdeaItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = ideaItemInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_inspiration_id) {
    const inspirationCheck = await validateOwnedInspirationReference(parsed.data.source_inspiration_id, resolved.session.workspace.id);
    if (!inspirationCheck.success) return inspirationCheck;
  }

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return createIdeaItem({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    sourceInspirationId: parsed.data.source_inspiration_id,
    contentFormat: parsed.data.content_format,
    hook: parsed.data.hook,
    cta: parsed.data.cta,
    audience: parsed.data.audience,
    notes: parsed.data.notes,
    mediaAssetId: parsed.data.media_asset_id,
    priority: parsed.data.priority,
  });
}

export async function updateIdeaItemAction(id: string, input: IdeaItemActionUpdateInput): Promise<Result<IdeaItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedIdeaItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };
  if (existing.status === "archived") return { success: false, error: ARCHIVED_EDIT_ERROR };

  const parsed = ideaItemUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_inspiration_id) {
    const inspirationCheck = await validateOwnedInspirationReference(parsed.data.source_inspiration_id, resolved.session.workspace.id);
    if (!inspirationCheck.success) return inspirationCheck;
  }

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return updateIdeaItem(id, {
    title: parsed.data.title,
    description: parsed.data.description,
    sourceInspirationId: parsed.data.source_inspiration_id,
    contentFormat: parsed.data.content_format,
    hook: parsed.data.hook,
    cta: parsed.data.cta,
    audience: parsed.data.audience,
    notes: parsed.data.notes,
    mediaAssetId: parsed.data.media_asset_id,
    priority: parsed.data.priority,
  });
}

export async function getIdeaItemAction(id: string): Promise<Result<IdeaItem>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const item = await loadOwnedIdeaItem(id, resolved.session.workspace.id);
  if (!item) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: item };
}

export interface ListIdeaItemsActionFilters {
  archived?: IdeaArchivedFilter;
  search?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/** Never allow an unbounded read regardless of what a caller asks for — mirrors `clampLimit` in `inspirationActions.ts` exactly. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export async function listIdeaItemsAction(filters: ListIdeaItemsActionFilters = {}): Promise<Result<IdeaItem[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  try {
    const items = await listIdeaItems(resolved.session.workspace.id, {
      archived: filters.archived,
      search: filters.search,
      limit: clampLimit(filters.limit),
    });
    return { success: true, data: items };
  } catch {
    return { success: false, error: "Could not load Ideas." };
  }
}

/**
 * The Idea Edit/Create dialog's own MediaAsset picker feed (SOCIAL-07D+).
 * Structurally mirrors `listInspirationMediaAssetOptionsAction` exactly —
 * same "resolve session, call `listMediaAssetsForWorkspace`, catch and
 * return a generic error" skeleton, same `social.create` permission (this
 * only ever serves the attach/replace flow, which lives alongside
 * archive/restore under `social.create`, not `social.view`). Workspace id
 * is resolved server-side, never trusted from the browser. Deliberately no
 * status/mime-type filter — an Idea may reference any file type, not just
 * publishable JPEGs, and this is not the Social publish-approval gate.
 */
export async function listIdeaMediaAssetOptionsAction(): Promise<Result<MediaAsset[]>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;
  try {
    const assets = await listMediaAssetsForWorkspace(resolved.session.workspace.id);
    return { success: true, data: assets };
  } catch {
    return { success: false, error: "Could not load files." };
  }
}

export async function archiveIdeaItemAction(id: string): Promise<Result<IdeaItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedIdeaItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  return archiveIdeaItem(id);
}

export async function unarchiveIdeaItemAction(id: string): Promise<Result<IdeaItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedIdeaItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  return unarchiveIdeaItem(id);
}

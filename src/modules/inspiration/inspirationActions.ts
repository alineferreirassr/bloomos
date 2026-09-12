"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createInspirationItem,
  getInspirationItemById,
  listInspirationItems,
  updateInspirationItem,
  archiveInspirationItem,
  unarchiveInspirationItem,
  getMediaAssetById,
  listMediaAssetsForWorkspace,
} from "@/lib/data";
import { validateInspirationSourceUrl, normalizeInspirationSourceUrl } from "@/lib/inspiration/normalizeUrl";
import { inspirationItemInputSchema, inspirationItemUpdateSchema } from "@/modules/inspiration/schema";
import type { InspirationItem, InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";
import type { InspirationArchivedFilter } from "@/lib/data/inspiration/repository";
import type { MediaAsset } from "@/types/mediaAsset";

/**
 * SOCIAL-06C — the production data-access/action layer for Inspiration &
 * Reference Library. Repository + Server Actions only, no UI (SOCIAL-06D+
 * owns that) — mirrors `socialPostActions.ts`'s own conventions exactly:
 * its own local `requireActiveSession`/`Result<T>`/`GENERIC_ACCESS_ERROR`
 * (copied, not imported — every Social action file does this), workspace
 * id and actor id resolved entirely server-side from
 * `resolveMemberSessionSnapshot()`, never trusted from the browser.
 */

const GENERIC_ACCESS_ERROR = "That isn't available. You may not have access to it.";
const NOT_FOUND_ERROR = "This Inspiration item could not be found.";
const VALIDATION_ERROR = "Please fix the highlighted fields.";
/**
 * SOCIAL-06E — matches the established, repeated precedent across every
 * other archive-capable domain checked (Workflows, Document Templates,
 * Services, Media Assets): editing an archived record is blocked, not
 * silently allowed — restore it first. `updateInspirationItemAction` below
 * already loads `existing` for ownership; this reuses that same fetch.
 */
const ARCHIVED_EDIT_ERROR = "An archived Inspiration item cannot be edited — restore it first.";

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

async function loadOwnedInspirationItem(id: string, workspaceId: string): Promise<InspirationItem | null> {
  const item = await getInspirationItemById(id).catch(() => null);
  if (!item || item.workspace_id !== workspaceId) return null;
  return item;
}

type AssetValidationResult = { success: true } | { success: false; error: string };

/**
 * Ownership-only — deliberately does NOT require an "approved" status the
 * way `validateOwnedApprovedImageAsset` (Social Posts' own publish gate)
 * does. Inspiration is a private reference/study library, not a publish
 * pipeline: the Documents precedent (`fetchMediaAssetRowFor` in
 * `documents/supabaseRepository.ts`) — existence + workspace ownership
 * only, no status gate — is the closer analog, and nothing in SOCIAL-06A/
 * 06B's own design notes requires an approval gate here.
 */
async function validateOwnedMediaAssetReference(assetId: string, workspaceId: string): Promise<AssetValidationResult> {
  const asset = await getMediaAssetById(assetId).catch(() => null);
  if (!asset || asset.workspace_id !== workspaceId) return { success: false, error: "That file could not be found." };
  return { success: true };
}

export interface InspirationItemActionInput {
  title: string;
  source_type: InspirationSourceType;
  source_url: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  platform_content_id: string | null;
  content_format: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  why_it_works: string | null;
  notes: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  media_asset_id: string | null;
}

export type InspirationItemActionUpdateInput = Partial<InspirationItemActionInput>;

export async function createInspirationItemAction(input: InspirationItemActionInput): Promise<Result<InspirationItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const parsed = inspirationItemInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  const urlCheck = validateInspirationSourceUrl(parsed.data.source_url);
  if (!urlCheck.valid) return { success: false, error: urlCheck.error ?? VALIDATION_ERROR };

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return createInspirationItem({
    workspaceId: resolved.session.workspace.id,
    createdBy: resolved.session.user.id,
    title: parsed.data.title,
    sourceType: parsed.data.source_type,
    sourceUrl: parsed.data.source_url,
    // Server-derived, never accepted from the browser — the action's own
    // input type above has no `normalized_source_url` field at all.
    normalizedSourceUrl: normalizeInspirationSourceUrl(parsed.data.source_url),
    creatorName: parsed.data.creator_name,
    creatorHandle: parsed.data.creator_handle,
    platformContentId: parsed.data.platform_content_id,
    contentFormat: parsed.data.content_format,
    hook: parsed.data.hook,
    cta: parsed.data.cta,
    whyItWorks: parsed.data.why_it_works,
    notes: parsed.data.notes,
    durationSeconds: parsed.data.duration_seconds,
    publishedAt: parsed.data.published_at,
    mediaAssetId: parsed.data.media_asset_id,
  });
}

export async function updateInspirationItemAction(id: string, input: InspirationItemActionUpdateInput): Promise<Result<InspirationItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedInspirationItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };
  if (existing.archived_at) return { success: false, error: ARCHIVED_EDIT_ERROR };

  const parsed = inspirationItemUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  if (parsed.data.source_url !== undefined) {
    const urlCheck = validateInspirationSourceUrl(parsed.data.source_url);
    if (!urlCheck.valid) return { success: false, error: urlCheck.error ?? VALIDATION_ERROR };
  }

  if (parsed.data.media_asset_id) {
    const assetCheck = await validateOwnedMediaAssetReference(parsed.data.media_asset_id, resolved.session.workspace.id);
    if (!assetCheck.success) return assetCheck;
  }

  return updateInspirationItem(id, {
    title: parsed.data.title,
    sourceType: parsed.data.source_type,
    sourceUrl: parsed.data.source_url,
    // Re-normalized from the (possibly new) source_url whenever it's part
    // of this update — never trusted from the browser, and never left
    // stale from the previous value when the URL changes.
    normalizedSourceUrl: parsed.data.source_url !== undefined ? normalizeInspirationSourceUrl(parsed.data.source_url) : undefined,
    creatorName: parsed.data.creator_name,
    creatorHandle: parsed.data.creator_handle,
    platformContentId: parsed.data.platform_content_id,
    contentFormat: parsed.data.content_format,
    hook: parsed.data.hook,
    cta: parsed.data.cta,
    whyItWorks: parsed.data.why_it_works,
    notes: parsed.data.notes,
    durationSeconds: parsed.data.duration_seconds,
    publishedAt: parsed.data.published_at,
    mediaAssetId: parsed.data.media_asset_id,
  });
}

export async function getInspirationItemAction(id: string): Promise<Result<InspirationItem>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  const item = await loadOwnedInspirationItem(id, resolved.session.workspace.id);
  if (!item) return { success: false, error: NOT_FOUND_ERROR };
  return { success: true, data: item };
}

export interface ListInspirationItemsActionFilters {
  archived?: InspirationArchivedFilter;
  sourceType?: InspirationSourceType;
  contentFormat?: InspirationContentFormat;
  search?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/** Never allow an unbounded read regardless of what a caller asks for — Phase 4's own instruction. */
function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export async function listInspirationItemsAction(filters: ListInspirationItemsActionFilters = {}): Promise<Result<InspirationItem[]>> {
  const resolved = await requireActiveSession("social.view");
  if (!resolved.success) return resolved;

  try {
    const items = await listInspirationItems(resolved.session.workspace.id, {
      archived: filters.archived,
      sourceType: filters.sourceType,
      contentFormat: filters.contentFormat,
      search: filters.search,
      limit: clampLimit(filters.limit),
    });
    return { success: true, data: items };
  } catch {
    return { success: false, error: "Could not load Inspiration items." };
  }
}

/**
 * SOCIAL-06E — the Edit dialog's own MediaAsset picker feed. Mirrors
 * `listSocialMediaAssetsAction`'s exact shape (`socialPostActions.ts`):
 * gated on this module's own permission (`social.create`, since the picker
 * only ever renders inside the write-gated Edit flow), workspace id
 * resolved server-side, never trusted from the browser. Deliberately no
 * status/mime-type filter — Phase 12's own instruction that Inspiration
 * attachment is not the Social publish-approval gate, and Inspiration may
 * reference any file type, not just publishable JPEGs. Excludes archived
 * assets by default (the repository's own `listMediaAssetsForWorkspace`
 * default), matching the same "don't offer a stale/withdrawn file" logic
 * `AssetLibraryView` already assumes.
 */
export async function listInspirationMediaAssetOptionsAction(): Promise<Result<MediaAsset[]>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;
  try {
    const assets = await listMediaAssetsForWorkspace(resolved.session.workspace.id);
    return { success: true, data: assets };
  } catch {
    return { success: false, error: "Could not load files." };
  }
}

export async function archiveInspirationItemAction(id: string): Promise<Result<InspirationItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedInspirationItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  return archiveInspirationItem(id);
}

export async function unarchiveInspirationItemAction(id: string): Promise<Result<InspirationItem>> {
  const resolved = await requireActiveSession("social.create");
  if (!resolved.success) return resolved;

  const existing = await loadOwnedInspirationItem(id, resolved.session.workspace.id);
  if (!existing) return { success: false, error: NOT_FOUND_ERROR };

  return unarchiveInspirationItem(id);
}

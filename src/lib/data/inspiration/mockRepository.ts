import type { InspirationItem } from "@/types/inspirationItem";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readInspirationItems, writeInspirationItems } from "@/lib/data/mock/inspirationItemsStore";
import type {
  InspirationItemsRepository,
  CreateInspirationItemInput,
  UpdateInspirationItemInput,
  ListInspirationItemsFilters,
} from "@/lib/data/inspiration/repository";

const NOT_FOUND_ERROR = "This Inspiration item could not be found.";
/** Mirrors the migration's two partial unique indexes — one message covers both, matching this codebase's single-message duplicate-error convention (vendors/purchases/finance/contracts/inventory all use exactly one message per table too). */
const DUPLICATE_ERROR = "This has already been saved to your Inspiration library.";

/** Mirrors the DB's two partial unique indexes exactly: `(workspace_id, normalized_source_url)` and `(workspace_id, source_type, platform_content_id)`, both `where ... is not null`. */
function hasConflict(
  items: InspirationItem[],
  workspaceId: string,
  normalizedSourceUrl: string | null,
  sourceType: string,
  platformContentId: string | null,
  excludeId?: string,
): boolean {
  return items.some((item) => {
    if (item.workspace_id !== workspaceId || item.id === excludeId) return false;
    if (normalizedSourceUrl !== null && item.normalized_source_url === normalizedSourceUrl) return true;
    if (platformContentId !== null && item.source_type === sourceType && item.platform_content_id === platformContentId) return true;
    return false;
  });
}

async function createInspirationItem(input: CreateInspirationItemInput): Promise<DataResult<InspirationItem>> {
  const items = readInspirationItems();
  if (hasConflict(items, input.workspaceId, input.normalizedSourceUrl, input.sourceType, input.platformContentId)) {
    return fail(DUPLICATE_ERROR);
  }

  const timestamp = nowIso();
  const item: InspirationItem = {
    id: generateId("inspiration_item"),
    workspace_id: input.workspaceId,
    title: input.title,
    source_type: input.sourceType,
    source_url: input.sourceUrl,
    normalized_source_url: input.normalizedSourceUrl,
    creator_name: input.creatorName,
    creator_handle: input.creatorHandle,
    platform_content_id: input.platformContentId,
    content_format: input.contentFormat,
    hook: input.hook,
    cta: input.cta,
    why_it_works: input.whyItWorks,
    notes: input.notes,
    duration_seconds: input.durationSeconds,
    published_at: input.publishedAt,
    media_asset_id: input.mediaAssetId,
    archived_at: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeInspirationItems([...items, item]);
  return ok(item);
}

async function getInspirationItemById(id: string): Promise<InspirationItem> {
  const item = readInspirationItems().find((i) => i.id === id);
  if (!item) throw new Error(NOT_FOUND_ERROR);
  return item;
}

async function listInspirationItems(workspaceId: string, filters: ListInspirationItemsFilters = {}): Promise<InspirationItem[]> {
  const { archived = "active", sourceType, contentFormat, search, limit = 50, offset = 0 } = filters;
  const trimmedSearch = search?.trim().toLowerCase();

  const filtered = readInspirationItems().filter((item) => {
    if (item.workspace_id !== workspaceId) return false;
    if (archived === "active" && item.archived_at !== null) return false;
    if (archived === "archived" && item.archived_at === null) return false;
    if (sourceType && item.source_type !== sourceType) return false;
    if (contentFormat && item.content_format !== contentFormat) return false;
    // Title only, matching the Supabase repository's own single-column
    // `.ilike("title", ...)` exactly — Phase 22's own "behavioral parity"
    // requirement, not a narrower mock-only search.
    if (trimmedSearch && !item.title.toLowerCase().includes(trimmedSearch)) return false;
    return true;
  });

  // Deterministic ordering: created_at desc, id desc tie-break — matches
  // the migration's own `inspiration_items_workspace_created_idx` and
  // `listJournalEntries`'s established (date desc, id desc) precedent.
  return filtered
    .sort((a, b) => {
      const byCreatedAt = b.created_at.localeCompare(a.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : b.id.localeCompare(a.id);
    })
    .slice(offset, offset + limit);
}

async function updateInspirationItem(id: string, input: UpdateInspirationItemInput): Promise<DataResult<InspirationItem>> {
  const items = readInspirationItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const nextNormalizedSourceUrl = input.normalizedSourceUrl !== undefined ? input.normalizedSourceUrl : existing.normalized_source_url;
  const nextSourceType = input.sourceType ?? existing.source_type;
  const nextPlatformContentId = input.platformContentId !== undefined ? input.platformContentId : existing.platform_content_id;

  if (hasConflict(items, existing.workspace_id, nextNormalizedSourceUrl, nextSourceType, nextPlatformContentId, id)) {
    return fail(DUPLICATE_ERROR);
  }

  const updated: InspirationItem = {
    ...existing,
    title: input.title ?? existing.title,
    source_type: nextSourceType,
    source_url: input.sourceUrl !== undefined ? input.sourceUrl : existing.source_url,
    normalized_source_url: nextNormalizedSourceUrl,
    creator_name: input.creatorName !== undefined ? input.creatorName : existing.creator_name,
    creator_handle: input.creatorHandle !== undefined ? input.creatorHandle : existing.creator_handle,
    platform_content_id: nextPlatformContentId,
    content_format: input.contentFormat !== undefined ? input.contentFormat : existing.content_format,
    hook: input.hook !== undefined ? input.hook : existing.hook,
    cta: input.cta !== undefined ? input.cta : existing.cta,
    why_it_works: input.whyItWorks !== undefined ? input.whyItWorks : existing.why_it_works,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    duration_seconds: input.durationSeconds !== undefined ? input.durationSeconds : existing.duration_seconds,
    published_at: input.publishedAt !== undefined ? input.publishedAt : existing.published_at,
    media_asset_id: input.mediaAssetId !== undefined ? input.mediaAssetId : existing.media_asset_id,
    updated_at: nowIso(),
  };

  writeInspirationItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function archiveInspirationItem(id: string): Promise<DataResult<InspirationItem>> {
  const items = readInspirationItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.archived_at !== null) return ok(existing);

  const updated: InspirationItem = { ...existing, archived_at: nowIso(), updated_at: nowIso() };
  writeInspirationItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function unarchiveInspirationItem(id: string): Promise<DataResult<InspirationItem>> {
  const items = readInspirationItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.archived_at === null) return ok(existing);

  const updated: InspirationItem = { ...existing, archived_at: null, updated_at: nowIso() };
  writeInspirationItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

export const mockInspirationItemsRepository: InspirationItemsRepository = {
  createInspirationItem,
  getInspirationItemById,
  listInspirationItems,
  updateInspirationItem,
  archiveInspirationItem,
  unarchiveInspirationItem,
};

import type { IdeaItem } from "@/types/ideaItem";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readIdeaItems, writeIdeaItems } from "@/lib/data/mock/ideaItemsStore";
import type {
  IdeaItemsRepository,
  CreateIdeaItemInput,
  UpdateIdeaItemInput,
  ListIdeaItemsFilters,
} from "@/lib/data/idea/repository";

const NOT_FOUND_ERROR = "This Idea could not be found.";

async function createIdeaItem(input: CreateIdeaItemInput): Promise<DataResult<IdeaItem>> {
  const items = readIdeaItems();

  const timestamp = nowIso();
  const item: IdeaItem = {
    id: generateId("idea_item"),
    workspace_id: input.workspaceId,
    title: input.title,
    description: input.description,
    status: "active",
    source_inspiration_id: input.sourceInspirationId,
    content_format: input.contentFormat,
    hook: input.hook,
    cta: input.cta,
    audience: input.audience,
    notes: input.notes,
    media_asset_id: input.mediaAssetId,
    priority: input.priority,
    archived_at: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeIdeaItems([...items, item]);
  return ok(item);
}

async function getIdeaItemById(id: string): Promise<IdeaItem> {
  const item = readIdeaItems().find((i) => i.id === id);
  if (!item) throw new Error(NOT_FOUND_ERROR);
  return item;
}

async function listIdeaItems(workspaceId: string, filters: ListIdeaItemsFilters = {}): Promise<IdeaItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const trimmedSearch = search?.trim().toLowerCase();

  const filtered = readIdeaItems().filter((item) => {
    if (item.workspace_id !== workspaceId) return false;
    if (archived === "active" && item.status !== "active") return false;
    if (archived === "archived" && item.status !== "archived") return false;
    // Title only, matching the Supabase repository's own single-column
    // `.ilike("title", ...)` exactly — behavioral parity, not a narrower
    // mock-only search.
    if (trimmedSearch && !item.title.toLowerCase().includes(trimmedSearch)) return false;
    return true;
  });

  // Deterministic ordering: created_at desc, id desc tie-break — matches
  // the migration's own `idea_items_workspace_created_idx` and
  // `listInspirationItems`'s established precedent exactly.
  return filtered
    .sort((a, b) => {
      const byCreatedAt = b.created_at.localeCompare(a.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : b.id.localeCompare(a.id);
    })
    .slice(offset, offset + limit);
}

async function updateIdeaItem(id: string, input: UpdateIdeaItemInput): Promise<DataResult<IdeaItem>> {
  const items = readIdeaItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const updated: IdeaItem = {
    ...existing,
    title: input.title ?? existing.title,
    description: input.description ?? existing.description,
    source_inspiration_id: input.sourceInspirationId !== undefined ? input.sourceInspirationId : existing.source_inspiration_id,
    content_format: input.contentFormat !== undefined ? input.contentFormat : existing.content_format,
    hook: input.hook !== undefined ? input.hook : existing.hook,
    cta: input.cta !== undefined ? input.cta : existing.cta,
    audience: input.audience !== undefined ? input.audience : existing.audience,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    media_asset_id: input.mediaAssetId !== undefined ? input.mediaAssetId : existing.media_asset_id,
    priority: input.priority !== undefined ? input.priority : existing.priority,
    updated_at: nowIso(),
  };

  writeIdeaItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function archiveIdeaItem(id: string): Promise<DataResult<IdeaItem>> {
  const items = readIdeaItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const updated: IdeaItem = { ...existing, status: "archived", archived_at: nowIso(), updated_at: nowIso() };
  writeIdeaItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function unarchiveIdeaItem(id: string): Promise<DataResult<IdeaItem>> {
  const items = readIdeaItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const updated: IdeaItem = { ...existing, status: "active", archived_at: null, updated_at: nowIso() };
  writeIdeaItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

export const mockIdeaItemsRepository: IdeaItemsRepository = {
  createIdeaItem,
  getIdeaItemById,
  listIdeaItems,
  updateIdeaItem,
  archiveIdeaItem,
  unarchiveIdeaItem,
};

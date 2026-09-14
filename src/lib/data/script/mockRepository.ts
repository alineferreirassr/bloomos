import type { ScriptItem } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { ScriptBlock } from "@/types/scriptBlock";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readScriptItems, writeScriptItems } from "@/lib/data/mock/scriptItemsStore";
import { readScriptVersions, writeScriptVersions } from "@/lib/data/mock/scriptVersionsStore";
import { readScriptBlocks, writeScriptBlocks } from "@/lib/data/mock/scriptBlocksStore";
import type {
  ScriptRepository,
  CreateScriptItemInput,
  UpdateScriptItemInput,
  ListScriptItemsFilters,
  CreateScriptVersionInput,
  CreateScriptBlockInput,
  UpdateScriptBlockInput,
} from "@/lib/data/script/repository";

const SCRIPT_NOT_FOUND_ERROR = "This Script could not be found.";
const SCRIPT_VERSION_NOT_FOUND_ERROR = "This Script version could not be found.";
const SCRIPT_BLOCK_NOT_FOUND_ERROR = "This Script block could not be found.";
/** Mirrors the DB's own `script_versions_one_draft_per_script` partial unique index. */
const DUPLICATE_DRAFT_ERROR = "This Script already has a draft version.";

async function createScriptItem(input: CreateScriptItemInput): Promise<DataResult<ScriptItem>> {
  const items = readScriptItems();

  const timestamp = nowIso();
  const item: ScriptItem = {
    id: generateId("script_item"),
    workspace_id: input.workspaceId,
    title: input.title,
    status: "active",
    source_idea_id: input.sourceIdeaId,
    archived_at: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeScriptItems([...items, item]);
  return ok(item);
}

async function getScriptItemById(id: string): Promise<ScriptItem> {
  const item = readScriptItems().find((i) => i.id === id);
  if (!item) throw new Error(SCRIPT_NOT_FOUND_ERROR);
  return item;
}

async function listScriptItems(workspaceId: string, filters: ListScriptItemsFilters = {}): Promise<ScriptItem[]> {
  const { archived = "active", search, limit = 50, offset = 0 } = filters;
  const trimmedSearch = search?.trim().toLowerCase();

  const filtered = readScriptItems().filter((item) => {
    if (item.workspace_id !== workspaceId) return false;
    if (archived === "active" && item.status !== "active") return false;
    if (archived === "archived" && item.status !== "archived") return false;
    if (trimmedSearch && !item.title.toLowerCase().includes(trimmedSearch)) return false;
    return true;
  });

  return filtered
    .sort((a, b) => {
      const byCreatedAt = b.created_at.localeCompare(a.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : b.id.localeCompare(a.id);
    })
    .slice(offset, offset + limit);
}

async function updateScriptItem(id: string, input: UpdateScriptItemInput): Promise<DataResult<ScriptItem>> {
  const items = readScriptItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(SCRIPT_NOT_FOUND_ERROR);

  const updated: ScriptItem = {
    ...existing,
    title: input.title ?? existing.title,
    source_idea_id: input.sourceIdeaId !== undefined ? input.sourceIdeaId : existing.source_idea_id,
    updated_at: nowIso(),
  };

  writeScriptItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function archiveScriptItem(id: string): Promise<DataResult<ScriptItem>> {
  const items = readScriptItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(SCRIPT_NOT_FOUND_ERROR);
  if (existing.status === "archived") return ok(existing);

  const updated: ScriptItem = { ...existing, status: "archived", archived_at: nowIso(), updated_at: nowIso() };
  writeScriptItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function unarchiveScriptItem(id: string): Promise<DataResult<ScriptItem>> {
  const items = readScriptItems();
  const existing = items.find((i) => i.id === id);
  if (!existing) return fail(SCRIPT_NOT_FOUND_ERROR);
  if (existing.status === "active") return ok(existing);

  const updated: ScriptItem = { ...existing, status: "active", archived_at: null, updated_at: nowIso() };
  writeScriptItems(items.map((i) => (i.id === id ? updated : i)));
  return ok(updated);
}

async function createScriptVersion(input: CreateScriptVersionInput): Promise<DataResult<ScriptVersion>> {
  const versions = readScriptVersions();
  const hasDraft = versions.some((v) => v.script_id === input.scriptId && v.status === "draft");
  if (hasDraft) return fail(DUPLICATE_DRAFT_ERROR);

  const timestamp = nowIso();
  const version: ScriptVersion = {
    id: generateId("script_version"),
    script_id: input.scriptId,
    workspace_id: input.workspaceId,
    status: "draft",
    version_number: null,
    published_at: null,
    published_by: null,
    created_by: input.createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeScriptVersions([...versions, version]);
  return ok(version);
}

async function getScriptVersionById(id: string): Promise<ScriptVersion> {
  const version = readScriptVersions().find((v) => v.id === id);
  if (!version) throw new Error(SCRIPT_VERSION_NOT_FOUND_ERROR);
  return version;
}

async function listScriptVersions(scriptId: string): Promise<ScriptVersion[]> {
  return readScriptVersions()
    .filter((v) => v.script_id === scriptId)
    .sort((a, b) => {
      const byCreatedAt = b.created_at.localeCompare(a.created_at);
      return byCreatedAt !== 0 ? byCreatedAt : b.id.localeCompare(a.id);
    });
}

async function createScriptBlock(input: CreateScriptBlockInput): Promise<DataResult<ScriptBlock>> {
  const blocks = readScriptBlocks();

  const timestamp = nowIso();
  const block: ScriptBlock = {
    id: generateId("script_block"),
    script_version_id: input.scriptVersionId,
    workspace_id: input.workspaceId,
    content: input.content,
    sort_order: input.sortOrder,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeScriptBlocks([...blocks, block]);
  return ok(block);
}

async function listScriptBlocks(scriptVersionId: string): Promise<ScriptBlock[]> {
  return readScriptBlocks()
    .filter((b) => b.script_version_id === scriptVersionId)
    .sort((a, b) => {
      const byOrder = a.sort_order - b.sort_order;
      return byOrder !== 0 ? byOrder : a.id.localeCompare(b.id);
    });
}

async function updateScriptBlock(id: string, input: UpdateScriptBlockInput): Promise<DataResult<ScriptBlock>> {
  const blocks = readScriptBlocks();
  const existing = blocks.find((b) => b.id === id);
  if (!existing) return fail(SCRIPT_BLOCK_NOT_FOUND_ERROR);

  const updated: ScriptBlock = {
    ...existing,
    content: input.content ?? existing.content,
    sort_order: input.sortOrder ?? existing.sort_order,
    updated_at: nowIso(),
  };

  writeScriptBlocks(blocks.map((b) => (b.id === id ? updated : b)));
  return ok(updated);
}

async function removeScriptBlock(id: string): Promise<DataResult<null>> {
  const blocks = readScriptBlocks();
  const existing = blocks.find((b) => b.id === id);
  if (!existing) return fail(SCRIPT_BLOCK_NOT_FOUND_ERROR);

  writeScriptBlocks(blocks.filter((b) => b.id !== id));
  return ok(null);
}

export const mockScriptRepository: ScriptRepository = {
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
};

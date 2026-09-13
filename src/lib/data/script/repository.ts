import type { ScriptItem, ScriptStatus } from "@/types/scriptItem";
import type { ScriptVersion } from "@/types/scriptVersion";
import type { ScriptBlock } from "@/types/scriptBlock";
import type { DataResult } from "@/lib/data/result";

export interface CreateScriptItemInput {
  workspaceId: string;
  /** The real `auth.users.id` UUID — never a display name/email. Mirrors `script_items.created_by`'s own uuid FK convention. */
  createdBy: string | null;
  title: string;
  /** Ownership against the caller's own workspace must already be verified by the Action layer before this is ever called — mirrors `createIdeaItem`'s own `sourceInspirationId` trust boundary. */
  sourceIdeaId: string | null;
}

export interface UpdateScriptItemInput {
  title?: string;
  sourceIdeaId?: string | null;
}

export type ScriptArchivedFilter = "active" | "archived" | "all";

export interface ListScriptItemsFilters {
  /** Defaults to "active" — an archived Script never appears in a plain list unless explicitly asked for. */
  archived?: ScriptArchivedFilter;
  /** Plain substring text, matched against title only. Never a filter DSL. */
  search?: string;
  /** Defaults to 50; the action layer clamps this before it ever reaches the repository — see `scriptActions.ts`. */
  limit?: number;
  offset?: number;
}

export interface CreateScriptVersionInput {
  scriptId: string;
  workspaceId: string;
  createdBy: string | null;
}

export interface CreateScriptBlockInput {
  scriptVersionId: string;
  workspaceId: string;
  content: string;
  sortOrder: number;
}

export interface UpdateScriptBlockInput {
  content?: string;
  sortOrder?: number;
}

/**
 * SOCIAL-08C — the production data-access layer for Script Studio.
 * Mirrors `ServicesRepository`'s own combined-domain shape (one repository
 * covering a parent entity, its versions, and their child rows) rather
 * than Idea/Inspiration's single-table shape, since Script is genuinely a
 * three-table domain (script_items → script_versions → script_blocks) —
 * splitting it into three separate repository files would fragment
 * operations that share the same version-scoped ownership chain for no
 * benefit. Reads return raw domain values (or throw, for a must-exist
 * single read), writes return `DataResult<T>`.
 *
 * Workspace ownership for any operation taking an existing `id` is
 * verified by the Action layer's own `loadOwned*` helpers before any of
 * these are called — the exact same trust boundary `loadOwnedIdeaItem`
 * already establishes — so these methods take only an `id`, never a
 * redundant `workspaceId`, except where the input itself already carries
 * one (create calls).
 *
 * No destructive delete exists for script_items (archive-only, matching
 * Idea's own convention) or for script_versions (append/update-only,
 * matching the DB's own no-DELETE-policy design). script_blocks has no
 * remove operation in this checkpoint either — the underlying migration
 * (SOCIAL-08B) deliberately created no DELETE policy for it; see
 * `scriptActions.ts`'s own doc comment and this checkpoint's final report
 * for the reasoning.
 */
export interface ScriptRepository {
  createScriptItem(input: CreateScriptItemInput): Promise<DataResult<ScriptItem>>;
  /** Throws if no row with this id exists at all — mirrors `getIdeaItemById` exactly. Cross-workspace ownership is the caller's own responsibility (see `loadOwnedScriptItem`). */
  getScriptItemById(id: string): Promise<ScriptItem>;
  listScriptItems(workspaceId: string, filters?: ListScriptItemsFilters): Promise<ScriptItem[]>;
  updateScriptItem(id: string, input: UpdateScriptItemInput): Promise<DataResult<ScriptItem>>;
  /** Idempotent — archiving an already-archived item returns it unchanged rather than erroring or re-stamping `archived_at`. */
  archiveScriptItem(id: string): Promise<DataResult<ScriptItem>>;
  /** Idempotent — unarchiving an already-active item returns it unchanged. */
  unarchiveScriptItem(id: string): Promise<DataResult<ScriptItem>>;

  /** Rejects with a controlled duplicate-draft error (mirrors the DB's own `script_versions_one_draft_per_script` partial unique index) if the Script already has a draft. */
  createScriptVersion(input: CreateScriptVersionInput): Promise<DataResult<ScriptVersion>>;
  getScriptVersionById(id: string): Promise<ScriptVersion>;
  listScriptVersions(scriptId: string): Promise<ScriptVersion[]>;

  createScriptBlock(input: CreateScriptBlockInput): Promise<DataResult<ScriptBlock>>;
  listScriptBlocks(scriptVersionId: string): Promise<ScriptBlock[]>;
  updateScriptBlock(id: string, input: UpdateScriptBlockInput): Promise<DataResult<ScriptBlock>>;
}

export type { ScriptStatus };

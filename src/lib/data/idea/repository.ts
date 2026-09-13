import type { IdeaItem, IdeaPriority, IdeaStatus } from "@/types/ideaItem";
import type { InspirationContentFormat } from "@/types/inspirationItem";
import type { DataResult } from "@/lib/data/result";

export interface CreateIdeaItemInput {
  workspaceId: string;
  /** The real `auth.users.id` UUID — never a display name/email. Mirrors `inspiration_items.created_by`'s own uuid FK convention. */
  createdBy: string | null;
  title: string;
  description: string;
  /** Ownership against the caller's own workspace must already be verified by the Action layer before this is ever called — mirrors `createInspirationItem`'s own `mediaAssetId` trust boundary. */
  sourceInspirationId: string | null;
  contentFormat: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  audience: string | null;
  notes: string | null;
  /** Ownership against the caller's own workspace must already be verified by the Action layer before this is ever called — mirrors `createInspirationItem`'s own `mediaAssetId` trust boundary. */
  mediaAssetId: string | null;
  priority: IdeaPriority | null;
}

export interface UpdateIdeaItemInput {
  title?: string;
  description?: string;
  sourceInspirationId?: string | null;
  contentFormat?: InspirationContentFormat | null;
  hook?: string | null;
  cta?: string | null;
  audience?: string | null;
  notes?: string | null;
  mediaAssetId?: string | null;
  priority?: IdeaPriority | null;
}

export type IdeaArchivedFilter = "active" | "archived" | "all";

export interface ListIdeaItemsFilters {
  /** Defaults to "active" — an archived Idea never appears in a plain list unless explicitly asked for. Implemented against the `status` column (not `archived_at`) since Idea, unlike Inspiration, carries a dedicated status field with its own index. */
  archived?: IdeaArchivedFilter;
  /** Plain substring text, matched against title only. Never a filter DSL. */
  search?: string;
  /** Defaults to 50; the action layer clamps this before it ever reaches the repository — see `ideaActions.ts`. */
  limit?: number;
  offset?: number;
}

/**
 * SOCIAL-07C — the production data-access layer for the Ideas Library.
 * Mirrors `InspirationItemsRepository`'s own dual mock/Supabase shape
 * exactly: reads return raw domain values (or throw, for a must-exist
 * single read), writes return `DataResult<T>`. Workspace ownership for
 * `getIdeaItemById`/`updateIdeaItem`/`archiveIdeaItem`/`unarchiveIdeaItem`
 * is verified by the Action layer's own `loadOwnedIdeaItem` before any of
 * these are called — the exact same trust boundary
 * `loadOwnedInspirationItem` already establishes — so these methods take
 * only an `id`, never a redundant `workspaceId`.
 *
 * No destructive delete exists — `status`/`archived_at` together are the
 * entire lifecycle, and no title uniqueness is imposed (SOCIAL-07A/07B's
 * own finding: no title-uniqueness precedent exists anywhere in this
 * schema).
 */
export interface IdeaItemsRepository {
  createIdeaItem(input: CreateIdeaItemInput): Promise<DataResult<IdeaItem>>;
  /** Throws if no row with this id exists at all — mirrors `getInspirationItemById` exactly. Cross-workspace ownership is the caller's own responsibility (see `loadOwnedIdeaItem`). */
  getIdeaItemById(id: string): Promise<IdeaItem>;
  listIdeaItems(workspaceId: string, filters?: ListIdeaItemsFilters): Promise<IdeaItem[]>;
  updateIdeaItem(id: string, input: UpdateIdeaItemInput): Promise<DataResult<IdeaItem>>;
  /** Idempotent — archiving an already-archived item returns it unchanged rather than erroring or re-stamping `archived_at`. Sets both `status: "archived"` and `archived_at`. */
  archiveIdeaItem(id: string): Promise<DataResult<IdeaItem>>;
  /** Idempotent — unarchiving an already-active item returns it unchanged. Sets both `status: "active"` and clears `archived_at`. */
  unarchiveIdeaItem(id: string): Promise<DataResult<IdeaItem>>;
}

export type { IdeaStatus };

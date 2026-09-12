import type { InspirationItem, InspirationSourceType, InspirationContentFormat } from "@/types/inspirationItem";
import type { DataResult } from "@/lib/data/result";

export interface CreateInspirationItemInput {
  workspaceId: string;
  /** The real `auth.users.id` UUID — never a display name/email. Matches `social_posts.created_by`'s own uuid FK convention, not `media_assets.approved_by`'s text convention. */
  createdBy: string | null;
  title: string;
  sourceType: InspirationSourceType;
  sourceUrl: string | null;
  /** Server-derived from `sourceUrl` via `normalizeInspirationSourceUrl` — never accepted directly from a caller. */
  normalizedSourceUrl: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  platformContentId: string | null;
  contentFormat: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  whyItWorks: string | null;
  notes: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  /** Ownership against the caller's own workspace must already be verified by the Action layer before this is ever called — the repository trusts it here, mirroring `createSocialPost`'s own `assetId` trust boundary. */
  mediaAssetId: string | null;
}

export interface UpdateInspirationItemInput {
  title?: string;
  sourceType?: InspirationSourceType;
  sourceUrl?: string | null;
  normalizedSourceUrl?: string | null;
  creatorName?: string | null;
  creatorHandle?: string | null;
  platformContentId?: string | null;
  contentFormat?: InspirationContentFormat | null;
  hook?: string | null;
  cta?: string | null;
  whyItWorks?: string | null;
  notes?: string | null;
  durationSeconds?: number | null;
  publishedAt?: string | null;
  mediaAssetId?: string | null;
}

export type InspirationArchivedFilter = "active" | "archived" | "all";

export interface ListInspirationItemsFilters {
  /** Defaults to "active" — an archived item never appears in a plain list unless explicitly asked for. */
  archived?: InspirationArchivedFilter;
  sourceType?: InspirationSourceType;
  contentFormat?: InspirationContentFormat;
  /** Plain substring text, matched against title/creator_name/notes. Never a filter DSL. */
  search?: string;
  /** Defaults to 50; the action layer clamps this before it ever reaches the repository — see `inspirationActions.ts`. */
  limit?: number;
  offset?: number;
}

/**
 * SOCIAL-06C — the production data-access layer for Inspiration & Reference
 * Library. Mirrors `SocialAnalyticsRepository`'s own dual mock/Supabase
 * shape exactly: reads return raw domain values (or throw, for a
 * must-exist single read), writes return `DataResult<T>`. Workspace
 * ownership for `getInspirationItemById`/`updateInspirationItem`/
 * `archiveInspirationItem`/`unarchiveInspirationItem` is verified by the
 * Action layer's own `loadOwnedInspirationItem` before any of these are
 * called — the exact same trust boundary `loadOwnedPost` already
 * establishes for Social Posts, so these methods take only an `id`, never
 * a redundant `workspaceId`.
 *
 * No destructive delete exists — `archived_at` is the entire lifecycle.
 */
export interface InspirationItemsRepository {
  createInspirationItem(input: CreateInspirationItemInput): Promise<DataResult<InspirationItem>>;
  /** Throws if no row with this id exists at all — mirrors `getSocialPost`/`getMediaAssetById` exactly. Cross-workspace ownership is the caller's own responsibility (see `loadOwnedInspirationItem`). */
  getInspirationItemById(id: string): Promise<InspirationItem>;
  listInspirationItems(workspaceId: string, filters?: ListInspirationItemsFilters): Promise<InspirationItem[]>;
  updateInspirationItem(id: string, input: UpdateInspirationItemInput): Promise<DataResult<InspirationItem>>;
  /** Idempotent — archiving an already-archived item returns it unchanged rather than erroring or re-stamping `archived_at`. */
  archiveInspirationItem(id: string): Promise<DataResult<InspirationItem>>;
  /** Idempotent — unarchiving an already-active item returns it unchanged. */
  unarchiveInspirationItem(id: string): Promise<DataResult<InspirationItem>>;
}

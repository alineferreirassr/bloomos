import type {
  MediaKit,
  MediaKitAnalyticsSummary,
  MediaKitBrandInput,
  MediaKitContentStatus,
  MediaKitGalleryItem,
  MediaKitGalleryItemInput,
  MediaKitPortfolioItem,
  MediaKitPortfolioItemInput,
  MediaKitRecentActivityItem,
  MediaKitServiceCuration,
  MediaKitServiceCurationInput,
} from "@/types/mediaKit";
import type { DataResult } from "@/lib/data/result";

/**
 * The Media Kit persistence contract — Foundation phase (MEDIAKIT-02/02.1).
 * `workspaceId` is an explicit parameter on every method rather than
 * resolved internally (the `requireWorkspaceSession()` pattern
 * Services/Inventory/Purchases use for direct client-side repository
 * calls) because every consumer of this repository is a Server Action that
 * has already resolved the caller's session once via
 * `resolveMemberSessionSnapshot()` — passing the id through avoids a second,
 * redundant session resolution and matches the same explicit-`workspaceId`
 * convention `core/integrations/*` engine functions already use for the
 * same reason.
 *
 * Only read + explicit-create operations exist this phase — Brand/Services/
 * Portfolio/Partners/Testimonials/Press/Gallery/Contact/Appearance editing,
 * and the Publish/Unpublish/Rollback actions, begin in MEDIAKIT-03 onward.
 *
 * MEDIAKIT-02.1 — founder correction: a plain page load must never
 * persist a row. `getMediaKit` is a pure read (returns `null` when the
 * workspace has none yet); `createMediaKit` is the one explicit mutation,
 * invoked only from the founder's own "Create Media Kit" action.
 */
export interface MediaKitRepository {
  /** Pure read — returns `null` if the workspace has no Media Kit yet. Never inserts. */
  getMediaKit(workspaceId: string): Promise<MediaKit | null>;

  /**
   * The one explicit creation path, called only from the founder's own
   * "Create Media Kit" action — never from a read/page-load path. Uses
   * schema defaults only (no fabricated brand copy, no seeded metrics). If
   * a concurrent call already created the row (the `unique(workspace_id)`
   * constraint), recovers safely by returning the existing row rather than
   * surfacing a duplicate-key error — a repeated/double submission is
   * never a broken experience.
   */
  createMediaKit(workspaceId: string): Promise<DataResult<MediaKit>>;

  getMediaKitContentStatus(workspaceId: string, mediaKitId: string): Promise<MediaKitContentStatus>;

  getMediaKitAnalyticsSummary(workspaceId: string, mediaKitId: string): Promise<MediaKitAnalyticsSummary>;

  getMediaKitRecentActivity(workspaceId: string, mediaKitId: string, limit?: number): Promise<MediaKitRecentActivityItem[]>;

  /** MEDIAKIT-03 — updates only the Brand identity/story/location fields. Trims text server-side; never requires every field. */
  updateMediaKitBrand(workspaceId: string, mediaKitId: string, input: MediaKitBrandInput): Promise<DataResult<MediaKit>>;

  /** Every curation row for this Media Kit, included or not — the caller joins it against the canonical Services catalog itself (never a second catalog fetch inside this repository). */
  listMediaKitServiceCurations(workspaceId: string, mediaKitId: string): Promise<MediaKitServiceCuration[]>;

  /**
   * The one include/exclude toggle. Get-or-create semantics, mirroring the
   * `media_kits` bootstrap precedent: if no curation row exists yet for
   * this (mediaKit, service) pair, `included: true` creates one (schema
   * defaults, `sort_order` appended after the current maximum); `included:
   * false` on a Service with no row is a no-op (nothing to exclude). An
   * existing row is simply updated, never duplicated (the
   * `unique(media_kit_id, service_id)` constraint is the backstop either
   * way).
   */
  setMediaKitServiceIncluded(workspaceId: string, mediaKitId: string, serviceId: string, included: boolean): Promise<DataResult<MediaKitServiceCuration>>;

  /** Edits overrides/public pricing/featured on an existing curation row (by its own id, not service_id). */
  updateMediaKitServiceCuration(workspaceId: string, curationId: string, input: MediaKitServiceCurationInput): Promise<DataResult<MediaKitServiceCuration>>;

  /** Batch reorder — assigns sort_order from array position in one call, mirroring `reorderContractExhibits`'s exact shape rather than one PATCH per move. */
  reorderMediaKitServices(workspaceId: string, mediaKitId: string, orderedCurationIds: string[]): Promise<DataResult<MediaKitServiceCuration[]>>;

  // ── MEDIAKIT-04 — Portfolio ──────────────────────────────────────────

  /** Every non-archived portfolio item for this Media Kit, included or not. */
  listMediaKitPortfolioItems(workspaceId: string, mediaKitId: string): Promise<MediaKitPortfolioItem[]>;

  /** Editorial curation only — never auto-derives fields from `event_id` even when one is linked. `sort_order` is appended after the current maximum. */
  createMediaKitPortfolioItem(workspaceId: string, mediaKitId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>>;

  updateMediaKitPortfolioItem(workspaceId: string, itemId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>>;

  /** Soft-delete — `media_kit_portfolio_items` has no delete RLS policy at all; `archived_at` is the only removal path. */
  archiveMediaKitPortfolioItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitPortfolioItem>>;

  /** Batch reorder — same array-position-as-sort_order shape as `reorderMediaKitServices`. */
  reorderMediaKitPortfolioItems(workspaceId: string, mediaKitId: string, orderedItemIds: string[]): Promise<DataResult<MediaKitPortfolioItem[]>>;

  // ── MEDIAKIT-04 — Gallery ────────────────────────────────────────────

  /**
   * `portfolioItemId: null` lists the top-level Gallery section;
   * a real id lists that specific portfolio item's own image set — one
   * shared table serves both scopes, matching the schema exactly.
   */
  listMediaKitGalleryItems(workspaceId: string, mediaKitId: string, portfolioItemId: string | null): Promise<MediaKitGalleryItem[]>;

  /** Curates an EXISTING `media_assets` row — never uploads/creates one. `sort_order` is appended after the current maximum within the same scope. */
  addMediaKitGalleryItem(workspaceId: string, mediaKitId: string, portfolioItemId: string | null, mediaAssetId: string): Promise<DataResult<MediaKitGalleryItem>>;

  /** Edits caption/cover/inclusion on an existing gallery row. Setting `is_cover: true` clears any other cover within the same (media_kit_id, portfolio_item_id) scope first — at most one cover per scope. */
  updateMediaKitGalleryItem(workspaceId: string, itemId: string, input: MediaKitGalleryItemInput): Promise<DataResult<MediaKitGalleryItem>>;

  /** Soft-delete — `media_kit_gallery_items` has no delete RLS policy either. */
  archiveMediaKitGalleryItem(workspaceId: string, itemId: string): Promise<DataResult<MediaKitGalleryItem>>;

  /** Batch reorder, scoped to one (media_kit_id, portfolio_item_id) gallery. */
  reorderMediaKitGalleryItems(workspaceId: string, mediaKitId: string, portfolioItemId: string | null, orderedItemIds: string[]): Promise<DataResult<MediaKitGalleryItem[]>>;

  // ── MEDIAKIT-04 — Publish ────────────────────────────────────────────

  /**
   * Wires the already-frozen `publish_media_kit(uuid)` RPC (see
   * supabase/migrations/20260929100200_media_kit_foundation.sql) — composes
   * an immutable snapshot from current draft data and repoints
   * `current_published_snapshot_id`. Returns the refreshed `MediaKit` row
   * (status/published_at/current_published_snapshot_id), not the raw
   * snapshot id the RPC itself returns, so callers get the same shape
   * every other mutation here returns.
   */
  publishMediaKit(workspaceId: string, mediaKitId: string): Promise<DataResult<MediaKit>>;
}

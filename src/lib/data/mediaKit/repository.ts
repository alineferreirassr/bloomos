import type { MediaKit, MediaKitAnalyticsSummary, MediaKitContentStatus, MediaKitRecentActivityItem } from "@/types/mediaKit";
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
}

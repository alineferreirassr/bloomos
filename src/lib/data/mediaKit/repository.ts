import type { MediaKit, MediaKitAnalyticsSummary, MediaKitContentStatus, MediaKitRecentActivityItem } from "@/types/mediaKit";

/**
 * The Media Kit persistence contract — Foundation phase (MEDIAKIT-02).
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
 * Only read + get-or-create operations exist this phase — Brand/Services/
 * Portfolio/Partners/Testimonials/Press/Gallery/Contact/Appearance editing,
 * and the Publish/Unpublish/Rollback actions, begin in MEDIAKIT-03 onward.
 */
export interface MediaKitRepository {
  /**
   * Returns the workspace's single `media_kits` row, creating a default one
   * (schema defaults only — no fabricated brand copy, no seeded metrics) on
   * first access. Mirrors the "no missing-row error case callers need to
   * handle" precedent `getOrCreateForProposal` already established.
   */
  getOrCreateMediaKit(workspaceId: string): Promise<MediaKit>;

  getMediaKitContentStatus(workspaceId: string, mediaKitId: string): Promise<MediaKitContentStatus>;

  getMediaKitAnalyticsSummary(workspaceId: string, mediaKitId: string): Promise<MediaKitAnalyticsSummary>;

  getMediaKitRecentActivity(workspaceId: string, mediaKitId: string, limit?: number): Promise<MediaKitRecentActivityItem[]>;
}

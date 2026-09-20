import { selectRepository } from "@/lib/data/provider";
import { mockMediaKitRepository } from "@/lib/data/mediaKit/mockRepository";
import { supabaseMediaKitRepository } from "@/lib/data/mediaKit/supabaseRepository";
import type { MediaKitOverview } from "@/types/mediaKit";

const repository = selectRepository({ mock: mockMediaKitRepository, supabase: supabaseMediaKitRepository });

/**
 * Self-contained module entry point — kept out of the central
 * `lib/data/index.ts` (which every other Phase 1 MVP business module wires
 * through) deliberately: that file is a single, very large, shared surface
 * covering dozens of unrelated modules, and Media Kit's own repository is
 * small enough this phase (read + get-or-create only) that adding it there
 * would be a wide-blast-radius edit for no real benefit. `selectRepository`
 * — the one thing that actually matters for the mock/Supabase convention —
 * is still used exactly the same way.
 */
export async function getMediaKitOverview(workspaceId: string): Promise<MediaKitOverview> {
  const mediaKit = await repository.getOrCreateMediaKit(workspaceId);
  const [contentStatus, analytics, recentActivity] = await Promise.all([
    repository.getMediaKitContentStatus(workspaceId, mediaKit.id),
    repository.getMediaKitAnalyticsSummary(workspaceId, mediaKit.id),
    repository.getMediaKitRecentActivity(workspaceId, mediaKit.id, 8),
  ]);
  return { mediaKit, contentStatus, analytics, recentActivity };
}

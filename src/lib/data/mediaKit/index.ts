import { selectRepository } from "@/lib/data/provider";
import { mockMediaKitRepository } from "@/lib/data/mediaKit/mockRepository";
import { supabaseMediaKitRepository } from "@/lib/data/mediaKit/supabaseRepository";
import type { DataResult } from "@/lib/data/result";
import type { MediaKit, MediaKitOverview } from "@/types/mediaKit";

const repository = selectRepository({ mock: mockMediaKitRepository, supabase: supabaseMediaKitRepository });

/**
 * Self-contained module entry point — kept out of the central
 * `lib/data/index.ts` (which every other Phase 1 MVP business module wires
 * through) deliberately: that file is a single, very large, shared surface
 * covering dozens of unrelated modules, and Media Kit's own repository is
 * small enough this phase (read + explicit-create only) that adding it
 * there would be a wide-blast-radius edit for no real benefit.
 * `selectRepository` — the one thing that actually matters for the
 * mock/Supabase convention — is still used exactly the same way.
 *
 * MEDIAKIT-02.1 — a plain page load must never persist a row. Returns
 * `null` when the workspace has no Media Kit yet; the caller (the Server
 * Action, then the view) renders the first-use setup state instead of
 * silently creating one.
 */
export async function getMediaKitOverview(workspaceId: string): Promise<MediaKitOverview | null> {
  const mediaKit = await repository.getMediaKit(workspaceId);
  if (!mediaKit) return null;

  const [contentStatus, analytics, recentActivity] = await Promise.all([
    repository.getMediaKitContentStatus(workspaceId, mediaKit.id),
    repository.getMediaKitAnalyticsSummary(workspaceId, mediaKit.id),
    repository.getMediaKitRecentActivity(workspaceId, mediaKit.id, 8),
  ]);
  return { mediaKit, contentStatus, analytics, recentActivity };
}

/** The one explicit creation path — invoked only from the founder's own "Create Media Kit" action. */
export async function createMediaKitForWorkspace(workspaceId: string): Promise<DataResult<MediaKit>> {
  return repository.createMediaKit(workspaceId);
}

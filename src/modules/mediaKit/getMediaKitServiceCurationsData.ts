"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, getMediaKitServiceCurationsForWorkspace } from "@/lib/data/mediaKit";
import type { MediaKitServiceCuration } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

export type GetMediaKitServiceCurationsDataResult = { success: true; data: MediaKitServiceCuration[] } | { success: false; error: string };

/**
 * This Media Kit's own curation rows only — a pure read, never mutates
 * state. The Services curator joins these against the canonical Services
 * catalog client-side (fetched directly via `getServicesCatalog()`, the
 * same already-proven client entry point `useServicesCatalog.ts` uses) —
 * see `MediaKitServicesCurator.tsx` and the doc comment on
 * `getMediaKitServiceCurationsForWorkspace` in `@/lib/data/mediaKit` for why
 * the catalog itself can't be fetched from this Server Action.
 */
export async function getMediaKitServiceCurationsData(): Promise<GetMediaKitServiceCurationsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return { success: false, error: NOT_FOUND_ERROR };

  const data = await getMediaKitServiceCurationsForWorkspace(session.workspace.id, mediaKit.id);
  return { success: true, data };
}

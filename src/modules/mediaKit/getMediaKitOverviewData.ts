"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitOverview } from "@/lib/data/mediaKit";
import type { MediaKitOverview } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

/**
 * `data: null` means "authenticated, no access issue, but this workspace
 * has no Media Kit yet" — the view renders the first-use setup state
 * rather than treating it as an error. This read path never creates a row
 * (MEDIAKIT-02.1) — see `createMediaKitAction.ts` for the one explicit
 * mutation.
 */
export type GetMediaKitOverviewDataResult = { success: true; data: MediaKitOverview | null } | { success: false; error: string };

/**
 * The Media Kit Manager's own self-fetch data source, mirroring
 * `getIntegrationsDashboardData.ts`'s exact shape. No dedicated permission
 * gate — Media Kit follows the same default-open-to-any-active-member
 * precedent Services (its closest architectural sibling) already
 * established; `kind !== "active"` is still the one real gate (no
 * unauthenticated or inactive-membership access).
 */
export async function getMediaKitOverviewData(): Promise<GetMediaKitOverviewDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const data = await getMediaKitOverview(session.workspace.id);
  return { success: true, data };
}

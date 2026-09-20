"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitOverview } from "@/lib/data/mediaKit";
import type { MediaKitOverview } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export type GetMediaKitOverviewDataResult = { success: true; data: MediaKitOverview } | { success: false; error: string };

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

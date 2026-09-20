"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, listMediaKitPortfolioItemsForWorkspace } from "@/lib/data/mediaKit";
import type { MediaKitPortfolioItem } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

export type GetMediaKitPortfolioItemsDataResult = { success: true; data: MediaKitPortfolioItem[] } | { success: false; error: string };

/** The Portfolio curator's own self-fetch data source — a pure read, never mutates state. */
export async function getMediaKitPortfolioItemsData(): Promise<GetMediaKitPortfolioItemsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return { success: false, error: NOT_FOUND_ERROR };

  const data = await listMediaKitPortfolioItemsForWorkspace(session.workspace.id, mediaKit.id);
  return { success: true, data };
}

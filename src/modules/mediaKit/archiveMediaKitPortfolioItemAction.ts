"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveMediaKitPortfolioItemForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPortfolioItem } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

/** Soft-delete — `media_kit_portfolio_items` has no delete RLS policy at all. */
export async function archiveMediaKitPortfolioItemAction(itemId: string): Promise<DataResult<MediaKitPortfolioItem>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  return archiveMediaKitPortfolioItemForWorkspace(session.workspace.id, itemId);
}

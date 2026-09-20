"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, listMediaKitGalleryItemsForWorkspace } from "@/lib/data/mediaKit";
import type { MediaKitGalleryItem } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

export type GetMediaKitGalleryItemsDataResult = { success: true; data: MediaKitGalleryItem[] } | { success: false; error: string };

/** The Gallery curator's own self-fetch data source — pure read, never mutates state. `portfolioItemId: null` reads the top-level Gallery section; a real id reads that specific portfolio item's own image set. */
export async function getMediaKitGalleryItemsData(portfolioItemId: string | null): Promise<GetMediaKitGalleryItemsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return { success: false, error: NOT_FOUND_ERROR };

  const data = await listMediaKitGalleryItemsForWorkspace(session.workspace.id, mediaKit.id, portfolioItemId);
  return { success: true, data };
}

"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveMediaKitGalleryItemForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitGalleryItem } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

/** Soft-delete — `media_kit_gallery_items` has no delete RLS policy either. */
export async function archiveMediaKitGalleryItemAction(itemId: string): Promise<DataResult<MediaKitGalleryItem>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  return archiveMediaKitGalleryItemForWorkspace(session.workspace.id, itemId);
}

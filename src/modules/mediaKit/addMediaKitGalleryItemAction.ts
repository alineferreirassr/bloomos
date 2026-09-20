"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { addMediaKitGalleryItemForWorkspace, getMediaKitForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitGalleryItem } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

/** Curates an EXISTING Media Asset — never uploads or creates one. `portfolioItemId: null` adds to the top-level Gallery section. */
export async function addMediaKitGalleryItemAction(portfolioItemId: string | null, mediaAssetId: string): Promise<DataResult<MediaKitGalleryItem>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return addMediaKitGalleryItemForWorkspace(session.workspace.id, mediaKit.id, portfolioItemId, mediaAssetId);
}

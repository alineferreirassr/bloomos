"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateMediaKitGalleryItemForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitGalleryItem, MediaKitGalleryItemInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const MAX_CAPTION_LENGTH = 200;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function updateMediaKitGalleryItemAction(itemId: string, input: MediaKitGalleryItemInput): Promise<DataResult<MediaKitGalleryItem>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const caption = trimOrNull(input.caption);
  if (caption && caption.length > MAX_CAPTION_LENGTH) return fail(`Caption must be ${MAX_CAPTION_LENGTH} characters or fewer.`);

  return updateMediaKitGalleryItemForWorkspace(session.workspace.id, itemId, { caption, is_cover: input.is_cover, is_included: input.is_included });
}

"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, updateMediaKitAppearanceForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit, MediaKitAppearance } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

/** The one curated Appearance key this checkpoint supports — a hero image chosen from existing Media Assets. No arbitrary CSS, no theme keys. */
export async function updateMediaKitAppearanceAction(input: MediaKitAppearance): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return updateMediaKitAppearanceForWorkspace(session.workspace.id, mediaKit.id, input);
}

"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, reorderMediaKitServicesForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitServiceCuration } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

/** Batch reorder — one call carries the full reordered array of curation ids; the server assigns `sort_order` from array position. */
export async function reorderMediaKitServicesAction(orderedCurationIds: string[]): Promise<DataResult<MediaKitServiceCuration[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return reorderMediaKitServicesForWorkspace(session.workspace.id, mediaKit.id, orderedCurationIds);
}

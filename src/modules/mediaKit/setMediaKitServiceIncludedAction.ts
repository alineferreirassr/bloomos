"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, setMediaKitServiceIncludedForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitServiceCuration } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

/** The one include/exclude toggle — curation only, over an existing canonical Service. Never creates a new Service. */
export async function setMediaKitServiceIncludedAction(serviceId: string, included: boolean): Promise<DataResult<MediaKitServiceCuration>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return setMediaKitServiceIncludedForWorkspace(session.workspace.id, mediaKit.id, serviceId, included);
}

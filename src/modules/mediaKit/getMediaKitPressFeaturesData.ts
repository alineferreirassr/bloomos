"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, listMediaKitPressFeaturesForWorkspace } from "@/lib/data/mediaKit";
import type { MediaKitPressFeature } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

export type GetMediaKitPressFeaturesDataResult = { success: true; data: MediaKitPressFeature[] } | { success: false; error: string };

export async function getMediaKitPressFeaturesData(): Promise<GetMediaKitPressFeaturesDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return { success: false, error: NOT_FOUND_ERROR };

  const data = await listMediaKitPressFeaturesForWorkspace(session.workspace.id, mediaKit.id);
  return { success: true, data };
}

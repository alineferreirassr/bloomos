"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveMediaKitPressFeatureForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPressFeature } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export async function archiveMediaKitPressFeatureAction(pressFeatureId: string): Promise<DataResult<MediaKitPressFeature>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return archiveMediaKitPressFeatureForWorkspace(session.workspace.id, pressFeatureId);
}

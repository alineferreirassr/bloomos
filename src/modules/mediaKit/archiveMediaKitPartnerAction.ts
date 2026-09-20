"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveMediaKitPartnerForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPartner } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export async function archiveMediaKitPartnerAction(partnerId: string): Promise<DataResult<MediaKitPartner>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return archiveMediaKitPartnerForWorkspace(session.workspace.id, partnerId);
}

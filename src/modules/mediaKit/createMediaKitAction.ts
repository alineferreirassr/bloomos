"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createMediaKitForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

/**
 * MEDIAKIT-02.1 — the one explicit creation path, invoked only from the
 * founder's own "Create Media Kit" button, never from a read/page-load
 * path (`getMediaKitOverviewData.ts` never inserts). Same session/access
 * gate as the read path — default-open to any active member, matching the
 * Services precedent.
 */
export async function createMediaKitAction(): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  return createMediaKitForWorkspace(session.workspace.id);
}

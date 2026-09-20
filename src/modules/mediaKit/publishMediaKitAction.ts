"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, publishMediaKitForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

/**
 * MEDIAKIT-04 — wires the already-frozen `publish_media_kit(uuid)` RPC.
 * No new migration, no redesign: this composes an immutable snapshot from
 * whatever is currently in the private editors and repoints
 * `media_kits.current_published_snapshot_id`, exactly what the function
 * itself already does server-side.
 */
export async function publishMediaKitAction(): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return publishMediaKitForWorkspace(session.workspace.id, mediaKit.id);
}

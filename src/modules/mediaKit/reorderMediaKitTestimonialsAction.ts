"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, reorderMediaKitTestimonialsForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitTestimonial } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

export async function reorderMediaKitTestimonialsAction(orderedTestimonialIds: string[]): Promise<DataResult<MediaKitTestimonial[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return reorderMediaKitTestimonialsForWorkspace(session.workspace.id, mediaKit.id, orderedTestimonialIds);
}

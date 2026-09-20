"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveMediaKitTestimonialForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitTestimonial } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

export async function archiveMediaKitTestimonialAction(testimonialId: string): Promise<DataResult<MediaKitTestimonial>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return archiveMediaKitTestimonialForWorkspace(session.workspace.id, testimonialId);
}

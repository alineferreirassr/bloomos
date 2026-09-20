"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { setMediaKitTestimonialApprovedForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitTestimonial } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

/** The dedicated approval gate — CRITICAL: this is the one thing that determines whether a testimonial can ever reach the public snapshot (alongside is_included). */
export async function setMediaKitTestimonialApprovedAction(testimonialId: string, approved: boolean): Promise<DataResult<MediaKitTestimonial>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);
  return setMediaKitTestimonialApprovedForWorkspace(session.workspace.id, testimonialId, approved);
}

"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateMediaKitTestimonialForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitTestimonial, MediaKitTestimonialInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const MAX_QUOTE_LENGTH = 1000;
const MAX_NAME_LENGTH = 160;
const MAX_ROLE_LENGTH = 160;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validate(input: MediaKitTestimonialInput): string | null {
  if (!input.quote.trim()) return "Quote is required.";
  if (input.quote.length > MAX_QUOTE_LENGTH) return `Quote must be ${MAX_QUOTE_LENGTH} characters or fewer.`;
  if (!input.author_name.trim()) return "Author name is required.";
  if (input.author_name.length > MAX_NAME_LENGTH) return `Author name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (input.author_role && input.author_role.length > MAX_ROLE_LENGTH) return `Author role must be ${MAX_ROLE_LENGTH} characters or fewer.`;
  return null;
}

export async function updateMediaKitTestimonialAction(testimonialId: string, input: MediaKitTestimonialInput): Promise<DataResult<MediaKitTestimonial>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitTestimonialInput = {
    client_id: input.client_id,
    quote: input.quote.trim(),
    author_name: input.author_name.trim(),
    author_role: trimOrNull(input.author_role),
    photo_media_asset_id: input.photo_media_asset_id,
    is_featured: input.is_featured,
    is_included: input.is_included,
  };

  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  return updateMediaKitTestimonialForWorkspace(session.workspace.id, testimonialId, normalized);
}

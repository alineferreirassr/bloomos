"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateMediaKitServiceCurationForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitServiceCuration, MediaKitServiceCurationInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

const MAX_OVERRIDE_LABEL_LENGTH = 160;
const MAX_OVERRIDE_DESCRIPTION_LENGTH = 1000;
const MAX_PRICE_LABEL_LENGTH = 80;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * An empty override must stay semantically empty — trimming never invents
 * content, it only normalizes whitespace-only input back to `null` so the
 * future public renderer's canonical fallback keeps working. Public pricing
 * is only ever what the founder explicitly typed here; nothing derives it
 * from internal cost/margin/contract data.
 */
function validateCurationInput(input: MediaKitServiceCurationInput): string | null {
  if (input.headline_override && input.headline_override.length > MAX_OVERRIDE_LABEL_LENGTH) {
    return `Headline override must be ${MAX_OVERRIDE_LABEL_LENGTH} characters or fewer.`;
  }
  if (input.description_override && input.description_override.length > MAX_OVERRIDE_DESCRIPTION_LENGTH) {
    return `Description override must be ${MAX_OVERRIDE_DESCRIPTION_LENGTH} characters or fewer.`;
  }
  if (input.public_price_label && input.public_price_label.length > MAX_PRICE_LABEL_LENGTH) {
    return `Public price label must be ${MAX_PRICE_LABEL_LENGTH} characters or fewer.`;
  }
  if (input.public_starting_price_minor !== null) {
    if (!Number.isInteger(input.public_starting_price_minor) || input.public_starting_price_minor < 0) {
      return "Public starting price must be a whole, non-negative amount.";
    }
  }
  return null;
}

export async function updateMediaKitServiceCurationAction(curationId: string, input: MediaKitServiceCurationInput): Promise<DataResult<MediaKitServiceCuration>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitServiceCurationInput = {
    headline_override: trimOrNull(input.headline_override),
    description_override: trimOrNull(input.description_override),
    public_starting_price_minor: input.public_starting_price_minor,
    public_price_label: trimOrNull(input.public_price_label),
    is_featured: input.is_featured,
  };

  const validationError = validateCurationInput(normalized);
  if (validationError) return fail(validationError);

  return updateMediaKitServiceCurationForWorkspace(session.workspace.id, curationId, normalized);
}

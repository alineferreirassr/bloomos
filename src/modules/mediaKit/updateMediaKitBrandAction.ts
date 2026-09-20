"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, updateMediaKitBrandForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit, MediaKitBrandInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";

const MAX_LABEL_LENGTH = 160;
const MAX_STATEMENT_LENGTH = 400;
const MAX_NARRATIVE_LENGTH = 4000;
const MIN_ESTABLISHED_YEAR = 1900;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * MEDIAKIT-03 — server-side validation mirrors what the form itself already
 * enforces (defense in depth for direct Server Action calls). Draft content
 * may be incomplete: every field stays optional, and no marketing/business
 * rule is imposed beyond sane length limits and a plausible year.
 */
function validateBrandInput(input: MediaKitBrandInput): string | null {
  if (input.headline && input.headline.length > MAX_LABEL_LENGTH) return `Headline must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.positioning_statement && input.positioning_statement.length > MAX_STATEMENT_LENGTH) {
    return `Positioning Statement must be ${MAX_STATEMENT_LENGTH} characters or fewer.`;
  }
  if (input.brand_narrative && input.brand_narrative.length > MAX_NARRATIVE_LENGTH) {
    return `Brand Story must be ${MAX_NARRATIVE_LENGTH} characters or fewer.`;
  }
  if (input.location_label && input.location_label.length > MAX_LABEL_LENGTH) return `Based In must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.service_area && input.service_area.length > MAX_LABEL_LENGTH) return `Service Area must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.specialty_label && input.specialty_label.length > MAX_LABEL_LENGTH) return `Specialty must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.established_year !== null) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(input.established_year) || input.established_year < MIN_ESTABLISHED_YEAR || input.established_year > currentYear) {
      return `Established must be a year between ${MIN_ESTABLISHED_YEAR} and ${currentYear}.`;
    }
  }
  return null;
}

export async function updateMediaKitBrandAction(input: MediaKitBrandInput): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitBrandInput = {
    headline: trimOrNull(input.headline),
    positioning_statement: trimOrNull(input.positioning_statement),
    brand_narrative: trimOrNull(input.brand_narrative),
    location_label: trimOrNull(input.location_label),
    service_area: trimOrNull(input.service_area),
    established_year: input.established_year,
    specialty_label: trimOrNull(input.specialty_label),
  };

  const validationError = validateBrandInput(normalized);
  if (validationError) return fail(validationError);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return updateMediaKitBrandForWorkspace(session.workspace.id, mediaKit.id, normalized);
}

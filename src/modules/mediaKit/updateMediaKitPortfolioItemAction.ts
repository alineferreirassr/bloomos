"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { updateMediaKitPortfolioItemForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPortfolioItem, MediaKitPortfolioItemInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";

const MAX_TITLE_LENGTH = 160;
const MAX_LABEL_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 1000;
const MIN_EVENT_YEAR = 1990;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validate(input: MediaKitPortfolioItemInput): string | null {
  if (!input.title.trim()) return "Title is required.";
  if (input.title.length > MAX_TITLE_LENGTH) return `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  if (input.category && input.category.length > MAX_LABEL_LENGTH) return `Category must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.location_label && input.location_label.length > MAX_LABEL_LENGTH) return `Location must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.short_description && input.short_description.length > MAX_DESCRIPTION_LENGTH) return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  if (input.event_year !== null) {
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(input.event_year) || input.event_year < MIN_EVENT_YEAR || input.event_year > currentYear + 1) {
      return `Year must be between ${MIN_EVENT_YEAR} and ${currentYear + 1}.`;
    }
  }
  return null;
}

export async function updateMediaKitPortfolioItemAction(itemId: string, input: MediaKitPortfolioItemInput): Promise<DataResult<MediaKitPortfolioItem>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitPortfolioItemInput = {
    event_id: input.event_id,
    title: input.title.trim(),
    category: trimOrNull(input.category),
    location_label: trimOrNull(input.location_label),
    event_year: input.event_year,
    short_description: trimOrNull(input.short_description),
    cover_media_asset_id: input.cover_media_asset_id,
    is_featured: input.is_featured,
    is_included: input.is_included,
  };

  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  return updateMediaKitPortfolioItemForWorkspace(session.workspace.id, itemId, normalized);
}

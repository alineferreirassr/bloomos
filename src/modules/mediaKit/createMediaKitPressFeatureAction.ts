"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createMediaKitPressFeatureForWorkspace, getMediaKitForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPressFeature, MediaKitPressFeatureInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";
const MAX_PUBLICATION_LENGTH = 160;
const MAX_TITLE_LENGTH = 200;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(input: MediaKitPressFeatureInput): string | null {
  if (!input.publication_name.trim()) return "Publication is required.";
  if (input.publication_name.length > MAX_PUBLICATION_LENGTH) return `Publication must be ${MAX_PUBLICATION_LENGTH} characters or fewer.`;
  if (input.feature_title && input.feature_title.length > MAX_TITLE_LENGTH) return `Feature title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  if (input.url && !isValidUrl(input.url)) return "URL must be a valid http(s) link.";
  if (input.featured_on && Number.isNaN(Date.parse(input.featured_on))) return "Date must be a valid date.";
  return null;
}

export async function createMediaKitPressFeatureAction(input: MediaKitPressFeatureInput): Promise<DataResult<MediaKitPressFeature>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitPressFeatureInput = {
    publication_name: input.publication_name.trim(),
    feature_title: trimOrNull(input.feature_title),
    url: trimOrNull(input.url),
    logo_media_asset_id: input.logo_media_asset_id,
    featured_on: trimOrNull(input.featured_on),
    is_featured: input.is_featured,
    is_included: input.is_included,
  };

  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return createMediaKitPressFeatureForWorkspace(session.workspace.id, mediaKit.id, normalized);
}

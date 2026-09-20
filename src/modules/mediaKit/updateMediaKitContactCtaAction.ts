"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, updateMediaKitContactCtaForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit, MediaKitContactCtaInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";
const MAX_HEADLINE_LENGTH = 160;
const MAX_SUBTEXT_LENGTH = 400;
const MAX_LABEL_LENGTH = 60;

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

function validate(input: MediaKitContactCtaInput): string | null {
  if (input.contact_headline && input.contact_headline.length > MAX_HEADLINE_LENGTH) return `Contact heading must be ${MAX_HEADLINE_LENGTH} characters or fewer.`;
  if (input.contact_subtext && input.contact_subtext.length > MAX_SUBTEXT_LENGTH) return `Contact supporting text must be ${MAX_SUBTEXT_LENGTH} characters or fewer.`;
  if (!input.primary_cta_label.trim()) return "CTA label is required.";
  if (input.primary_cta_label.length > MAX_LABEL_LENGTH) return `CTA label must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.primary_cta_type === "external_url" && (!input.primary_cta_external_url || !isValidUrl(input.primary_cta_external_url))) {
    return "A valid http(s) URL is required when the primary CTA links externally.";
  }
  if (input.secondary_cta_label && input.secondary_cta_label.length > MAX_LABEL_LENGTH) return `Secondary CTA label must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  if (input.secondary_cta_url && !isValidUrl(input.secondary_cta_url)) return "Secondary CTA URL must be a valid http(s) link.";
  return null;
}

/** Only `media_kits`' own contact/CTA columns — never exposes internal workspace/member contact data, and never invents a schema field. */
export async function updateMediaKitContactCtaAction(input: MediaKitContactCtaInput): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitContactCtaInput = {
    contact_headline: trimOrNull(input.contact_headline),
    contact_subtext: trimOrNull(input.contact_subtext),
    primary_cta_label: input.primary_cta_label.trim(),
    primary_cta_type: input.primary_cta_type,
    primary_cta_external_url: input.primary_cta_type === "external_url" ? trimOrNull(input.primary_cta_external_url) : null,
    secondary_cta_label: trimOrNull(input.secondary_cta_label),
    secondary_cta_url: trimOrNull(input.secondary_cta_url),
  };

  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return updateMediaKitContactCtaForWorkspace(session.workspace.id, mediaKit.id, normalized);
}

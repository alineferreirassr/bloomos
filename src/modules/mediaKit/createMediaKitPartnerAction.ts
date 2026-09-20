"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createMediaKitPartnerForWorkspace, getMediaKitForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKitPartner, MediaKitPartnerInput } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";
const MAX_NAME_LENGTH = 160;
const MAX_TYPE_LENGTH = 80;

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function validate(input: MediaKitPartnerInput): string | null {
  if (input.client_id && input.vendor_id) return "A partner can reference a Client or a Vendor, never both.";
  if (!input.display_name.trim()) return "Display name is required.";
  if (input.display_name.length > MAX_NAME_LENGTH) return `Display name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  if (input.partner_type && input.partner_type.length > MAX_TYPE_LENGTH) return `Partner type must be ${MAX_TYPE_LENGTH} characters or fewer.`;
  return null;
}

/** Editorial curation only — `display_name` is always what the founder typed here, never auto-populated from a linked Client/Vendor's real name. */
export async function createMediaKitPartnerAction(input: MediaKitPartnerInput): Promise<DataResult<MediaKitPartner>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized: MediaKitPartnerInput = {
    client_id: input.client_id,
    vendor_id: input.vendor_id,
    display_name: input.display_name.trim(),
    logo_media_asset_id: input.logo_media_asset_id,
    partner_type: trimOrNull(input.partner_type),
    is_featured: input.is_featured,
    is_included: input.is_included,
  };

  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return createMediaKitPartnerForWorkspace(session.workspace.id, mediaKit.id, normalized);
}

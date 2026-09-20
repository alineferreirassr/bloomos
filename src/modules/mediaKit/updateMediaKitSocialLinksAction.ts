"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMediaKitForWorkspace, updateMediaKitSocialLinksForWorkspace } from "@/lib/data/mediaKit";
import type { DataResult } from "@/lib/data/result";
import { fail } from "@/lib/data/result";
import type { MediaKit, MediaKitSocialLink } from "@/types/mediaKit";

const GENERIC_ACCESS_ERROR = "The Media Kit isn't available.";
const NOT_FOUND_ERROR = "This Media Kit could not be found.";
const MAX_LINKS = 12;
const MAX_HANDLE_LENGTH = 300;

function validate(links: MediaKitSocialLink[]): string | null {
  if (links.length > MAX_LINKS) return `You can add up to ${MAX_LINKS} social links.`;
  for (const link of links) {
    if (!link.platform.trim()) return "Every social link needs a platform name.";
    if (!link.handle_or_url.trim()) return "Every social link needs a handle or URL.";
    if (link.handle_or_url.length > MAX_HANDLE_LENGTH) return `Handle/URL must be ${MAX_HANDLE_LENGTH} characters or fewer.`;
  }
  return null;
}

/** Replaces the full array — the UI always sends the complete intended list. Never persists integration tokens/account ids; only display-safe {platform, handle_or_url, is_visible}. */
export async function updateMediaKitSocialLinksAction(links: MediaKitSocialLink[]): Promise<DataResult<MediaKit>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return fail(GENERIC_ACCESS_ERROR);

  const normalized = links.map((link) => ({ platform: link.platform.trim(), handle_or_url: link.handle_or_url.trim(), is_visible: link.is_visible }));
  const validationError = validate(normalized);
  if (validationError) return fail(validationError);

  const mediaKit = await getMediaKitForWorkspace(session.workspace.id);
  if (!mediaKit) return fail(NOT_FOUND_ERROR);

  return updateMediaKitSocialLinksForWorkspace(session.workspace.id, mediaKit.id, normalized);
}

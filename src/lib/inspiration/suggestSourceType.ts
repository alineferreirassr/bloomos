import type { InspirationSourceType } from "@/types/inspirationItem";

/**
 * SOCIAL-06D — pure, client-side hostname string matching only. No network
 * request, no redirect resolution, no scraping, no metadata fetch (Phase 15
 * of the checkpoint explicitly forbids all of those). Returns `null` for a
 * malformed URL or an unrecognized hostname — the caller must never coerce
 * that into a guessed "website"/"other" fallback, since that would silently
 * override a source type the founder deliberately chose.
 */
export function suggestSourceTypeFromUrl(rawUrl: string): InspirationSourceType | null {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "instagram";
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "tiktok";
  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") return "youtube";
  if (hostname === "pinterest.com" || hostname.endsWith(".pinterest.com") || hostname === "pin.it") return "pinterest";
  return null;
}

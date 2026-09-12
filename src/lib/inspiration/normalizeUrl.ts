/**
 * SOCIAL-06B — pure, deterministic URL validation/normalization for the
 * Inspiration & Reference Library. No network request, DNS lookup,
 * redirect resolution, or scraping of any kind — a source_url is either
 * absent (a manual reference) or validated/normalized purely from the
 * string the founder pasted in.
 */

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

/** Exact-match tracking parameter names — never partial/prefix matches beyond the explicit `utm_` case below, to avoid accidentally stripping a meaningful parameter that happens to share a substring. */
const TRACKING_PARAM_EXACT_MATCHES = new Set(["fbclid", "igshid", "si", "ref", "ref_src"]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith("utm_") || TRACKING_PARAM_EXACT_MATCHES.has(lower);
}

function parseUrlSafely(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export interface InspirationUrlValidationResult {
  valid: boolean;
  /** Present only when valid is false — a short, founder-facing message, never a raw parser error. */
  error?: string;
}

/**
 * `rawUrl` may be null/undefined/empty — a manual (URL-less) Inspiration
 * reference is always valid. When present, only `http`/`https` is
 * accepted; `javascript:`, `data:`, `file:`, `ftp:`, and every other
 * scheme is rejected, as is a malformed URL of any kind.
 */
export function validateInspirationSourceUrl(rawUrl: string | null | undefined): InspirationUrlValidationResult {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return { valid: true };

  const parsed = parseUrlSafely(trimmed);
  if (!parsed) return { valid: false, error: "That doesn't look like a valid URL." };
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return { valid: false, error: "Only http and https links are supported." };

  return { valid: true };
}

/**
 * Returns `null` for a null/empty/invalid/disallowed-scheme `rawUrl` —
 * callers that need to distinguish "no URL" from "invalid URL" should
 * call `validateInspirationSourceUrl` first. For a valid `http`/`https`
 * URL, returns a normalized string: lowercased hostname, fragment
 * removed, a trailing slash removed from any non-root path, and every
 * known tracking parameter (`utm_*`, `fbclid`, `igshid`, `si`, `ref`,
 * `ref_src`) stripped — every other query parameter is preserved
 * untouched and in its original order. Never extracts a platform content
 * id, never guesses a platform-specific canonical form, never resolves a
 * redirect.
 */
export function normalizeInspirationSourceUrl(rawUrl: string | null | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;

  const parsed = parseUrlSafely(trimmed);
  if (!parsed || !ALLOWED_SCHEMES.has(parsed.protocol)) return null;

  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";

  const trackingKeys: string[] = [];
  parsed.searchParams.forEach((_value, key) => {
    if (isTrackingParam(key)) trackingKeys.push(key);
  });
  for (const key of trackingKeys) parsed.searchParams.delete(key);

  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString();
}

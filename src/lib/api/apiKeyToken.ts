/**
 * API Key secret generation/hashing — mirrors `lib/team/invitationToken.ts`'s
 * own exact discipline: a 256-bit random value, base64url-encoded; the
 * stored/compared value is the lowercase hex SHA-256 digest of the full
 * secret string's UTF-8 bytes. The real secret is returned to the caller
 * exactly once (at creation/rotation time) and never persisted anywhere —
 * only its hash and a short, non-reversible display prefix are stored.
 */

const KEY_PREFIX_TAG = "bloom_sk_";
/** How much of the real secret is safe to keep visible in the Developer Console after creation — long enough to recognize a key, far too short to reconstruct it. */
const DISPLAY_PREFIX_LENGTH = 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A fresh, unguessable API Key secret — 256 bits of entropy, prefixed so it's recognizable as a BloomOS key in a log line or a leaked-secret scanner. */
export function generateApiKeySecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${KEY_PREFIX_TAG}${toBase64Url(bytes)}`;
}

/** Lowercase hex SHA-256 of the secret's UTF-8 bytes — what's actually stored (`ApiKey.key_hash`) and compared against on every request. */
export async function hashApiKeySecret(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The non-secret prefix shown in the Developer Console — never enough of the real secret to be useful to an attacker. */
export function displayPrefix(secret: string): string {
  return secret.slice(0, DISPLAY_PREFIX_LENGTH);
}

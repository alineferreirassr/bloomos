/**
 * Invitation token generation/hashing — the single implementation both the
 * mock and Supabase repositories call, matching the exact convention the
 * Postgres side (get_invitation_by_token/accept_workspace_invitation,
 * supabase/migrations/20260724100500_invitation_helper_functions.sql)
 * expects: a 256-bit random value, base64url-encoded to a string; the
 * stored/compared hash is the lowercase hex SHA-256 digest of that
 * string's UTF-8 bytes. `crypto.subtle`/`crypto.getRandomValues` are
 * available in both the browser and Node's `globalThis.crypto`, the same
 * "works unchanged in mock and Supabase mode" precedent as
 * lib/media/checksum.ts's real MediaAsset checksums — never a plaintext
 * token stored anywhere, per the approved invitation security design.
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A fresh, unguessable single-use invitation token — 256 bits of entropy, URL-safe. Never persisted; embedded directly in the invitation link. */
export function generateInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(bytes);
}

/** Lowercase hex SHA-256 of the token string's UTF-8 bytes — what's actually stored (`token_hash`) and compared against. */
export async function hashInvitationToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

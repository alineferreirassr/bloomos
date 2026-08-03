/**
 * Checkpoint 17, Step 2 — Webhook Secret generation. Mirrors
 * `lib/api/apiKeyToken.ts`'s own `generateApiKeySecret()`/`displayPrefix()`
 * exactly (256 bits of entropy, base64url-encoded, a recognizable
 * prefix), except this secret is never hashed for storage — see
 * `types/webhookEndpoint.ts`'s own doc comment for why a signing secret
 * can't be one-way hashed the way an authentication secret can.
 */

const SECRET_PREFIX_TAG = "whsec_";
const DISPLAY_PREFIX_LENGTH = 12;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A fresh, unguessable Webhook Secret — 256 bits of entropy, prefixed so it's recognizable as a BloomOS webhook secret in a log line or a leaked-secret scanner. */
export function generateWebhookSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${SECRET_PREFIX_TAG}${toBase64Url(bytes)}`;
}

/** The non-secret prefix shown in the Developer Console after the initial reveal — never enough of the real secret to forge a signature. */
export function displayPrefix(secret: string): string {
  return secret.slice(0, DISPLAY_PREFIX_LENGTH);
}

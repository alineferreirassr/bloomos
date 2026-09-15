import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * SOCIAL-11C — Meta/Instagram webhook authenticity, verified against
 * Meta's own long-stable, publicly documented Webhooks product contract
 * (developers.facebook.com/docs/graph-api/webhooks/getting-started —
 * shared identically across Messenger/Instagram/WhatsApp, unlike
 * per-product Graph API surface like `metaProvider.ts`'s own publish/
 * insights endpoints, so this is not expected to drift the way a pinned
 * Graph API version might):
 *
 * - GET verification handshake: Meta calls the callback URL once when a
 *   developer saves it in the App Dashboard (and again on any
 *   resubscribe), with `hub.mode=subscribe`, `hub.verify_token=<a value
 *   the app owner chose and configured in the Dashboard>`, and
 *   `hub.challenge=<a random string>`. The receiver must echo back
 *   exactly `hub.challenge` as a plain-text 200 response iff `hub.mode`
 *   is `"subscribe"` and `hub.verify_token` matches — otherwise it must
 *   fail closed (never echo a mismatched or missing token's challenge).
 * - POST delivery authenticity: every event POST carries an
 *   `X-Hub-Signature-256: sha256=<hex>` header, an HMAC-SHA256 of the raw
 *   request body keyed by the App's own Client Secret (the exact same
 *   secret already resolved via `META_OAUTH_CLIENT_SECRET` for the OAuth
 *   token exchange in `oauthTokenExchange.ts` — Meta issues one Client
 *   Secret per App, reused for both purposes; this is not a second
 *   secret).
 *
 * GAP/REQUIREMENT (cannot be proven from this repository's own code or
 * docs, so not invented): `META_WEBHOOK_VERIFY_TOKEN` is a NEW required
 * server env var — a value BloomOS itself must generate and register in
 * the Meta App Dashboard's own Webhooks configuration before this
 * receiver can be activated for real. Nothing in this checkpoint
 * fabricates or defaults a value for it; `verifyMetaWebhookChallenge`
 * fails closed (never verified) when it is unset.
 */

const META_APP_SECRET_ENV_VAR = "META_OAUTH_CLIENT_SECRET";
const META_WEBHOOK_VERIFY_TOKEN_ENV_VAR = "META_WEBHOOK_VERIFY_TOKEN";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export type MetaWebhookChallengeResult = { verified: true; challenge: string } | { verified: false };

/** Fails closed on any missing/mismatched piece — never echoes a challenge unless mode, token, and challenge all check out against a real configured META_WEBHOOK_VERIFY_TOKEN. */
export function verifyMetaWebhookChallenge(params: { mode: string | null; verifyToken: string | null; challenge: string | null }): MetaWebhookChallengeResult {
  const expectedToken = readEnv(META_WEBHOOK_VERIFY_TOKEN_ENV_VAR);
  if (!expectedToken) return { verified: false };
  if (params.mode !== "subscribe") return { verified: false };
  if (!params.challenge) return { verified: false };
  if (!params.verifyToken || params.verifyToken !== expectedToken) return { verified: false };
  return { verified: true, challenge: params.challenge };
}

/**
 * Verifies `X-Hub-Signature-256` over the exact raw body bytes Meta signed
 * — the caller must pass the untouched request body text, never a
 * re-serialized/re-parsed version of it (an HMAC breaks on any
 * byte-level difference, even whitespace). Timing-safe comparison, never
 * a plain `===`/`includes` on the hex digest — the same discipline every
 * credential/secret comparison in this codebase already follows.
 */
export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = readEnv(META_APP_SECRET_ENV_VAR);
  if (!appSecret || !signatureHeader) return false;

  const [algo, providedHex] = signatureHeader.split("=");
  if (algo !== "sha256" || !providedHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const expected = Buffer.from(expectedHex, "hex");
  let provided: Buffer;
  try {
    provided = Buffer.from(providedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

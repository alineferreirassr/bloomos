/**
 * Checkpoint 17, Step 3 — Webhook signing. `HMAC-SHA256(secret, "<timestamp>.<body>")`,
 * a signature header shaped `t=<unix seconds>,v1=<hex digest>` — the same
 * scheme Stripe's own webhook signatures use, deliberately reused rather
 * than invented, since it's a well-known, well-documented convention a
 * third-party developer is likely to already recognize.
 *
 * Replay protection: the timestamp-tolerance check in
 * `verifyWebhookSignature()` below is real, working replay *mitigation* —
 * a signature more than `toleranceSeconds` old is rejected outright, so a
 * captured request can't be replayed indefinitely. What's a genuine
 * placeholder (per Step 3's own wording) is full replay *prevention*
 * within that tolerance window: this checkpoint doesn't track "signatures
 * already seen" (a nonce/dedup cache), so a request captured and replayed
 * within the same few minutes would still verify. A future checkpoint
 * only needs to add that one cache to close the remaining gap — the
 * timestamp check, the header shape, and every call site are already
 * correct.
 */

export const WEBHOOK_SIGNATURE_HEADER = "x-bloomos-signature";
const DEFAULT_REPLAY_TOLERANCE_SECONDS = 300;

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The exact bytes signed are `"<unix-seconds-timestamp>.<raw JSON body>"` — never the body alone, so a captured signature can't be replayed under a different timestamp. */
export async function signWebhookPayload(secret: string, timestampSeconds: string, body: string): Promise<string> {
  return hmacSha256Hex(secret, `${timestampSeconds}.${body}`);
}

export function buildSignatureHeader(signature: string, timestampSeconds: string): string {
  return `t=${timestampSeconds},v1=${signature}`;
}

interface ParsedSignatureHeader {
  timestamp: string;
  signature: string;
}

function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  const parts: Record<string, string> = {};
  for (const segment of header.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

/** Constant-time string comparison — a signature check that short-circuits on the first mismatched byte leaks timing information an attacker can use to forge a valid signature one byte at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface VerifyWebhookSignatureParams {
  /** The exact raw request body bytes/string BloomOS sent — never a re-serialized/re-parsed version, since key ordering could change the signed bytes. */
  payload: string;
  header: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}

export interface VerifyWebhookSignatureResult {
  valid: boolean;
  reason?: string;
}

/**
 * What a receiving third-party system runs on its own end to confirm a
 * webhook actually came from BloomOS. BloomOS itself never calls this in
 * the delivery path (the dispatcher only ever signs, never verifies its
 * own outgoing request) — it exists so this exact logic can be unit
 * tested against `signWebhookPayload()`'s own output, and so
 * `docs/webhooks.md` can point to real, executable code rather than prose
 * alone for its "Verification examples."
 */
export async function verifyWebhookSignature(params: VerifyWebhookSignatureParams): Promise<VerifyWebhookSignatureResult> {
  const parsed = parseSignatureHeader(params.header);
  if (!parsed) return { valid: false, reason: "Malformed signature header." };

  const timestampSeconds = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return { valid: false, reason: "Malformed timestamp." };

  const tolerance = params.toleranceSeconds ?? DEFAULT_REPLAY_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    return { valid: false, reason: "Timestamp outside tolerance window — possible replay." };
  }

  const expected = await signWebhookPayload(params.secret, parsed.timestamp, params.payload);
  if (!timingSafeEqual(expected, parsed.signature)) return { valid: false, reason: "Signature does not match." };

  return { valid: true };
}

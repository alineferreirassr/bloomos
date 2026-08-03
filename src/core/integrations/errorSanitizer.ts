import { generateErrorRecordId } from "@/lib/data/core/integrations/errorRecordStore";
import { nowIso } from "@/lib/data/utils";
import type { IntegrationErrorCategory, IntegrationErrorRecord } from "@/core/integrations/types";

/**
 * v2 Checkpoint 43 — Security. Every adapter constructs error records
 * through this function rather than serializing a caught exception
 * directly, so a secret that happened to leak into an error message (a
 * token in a URL, a key in a header dump) never reaches the Audit Log,
 * Analytics, Timeline, or the Diagnostics UI.
 *
 * Redaction rules (applied in order, all case-insensitive):
 *  - Bearer tokens: `Bearer <token>` -> `Bearer [REDACTED]`
 *  - Anything that looks like an API secret/key assignment (`key=`,
 *    `secret=`, `token=`, `password=`) -> value redacted
 *  - Provider-prefixed secret patterns (Stripe `sk_`/`rk_`/`whsec_`,
 *    OAuth-style `ya29.`) -> redacted regardless of surrounding context
 *  - Anything 20+ contiguous base64url-ish characters (a plausible opaque
 *    token/secret) -> redacted, since a false positive (over-redacting a
 *    harmless long id) is a far safer failure mode than under-redacting
 */
const REDACTION_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(key|secret|token|password|auth)["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{6,}["']?/gi,
  /\bsk_(?:test|live)_[A-Za-z0-9]+/gi,
  /\brk_(?:test|live)_[A-Za-z0-9]+/gi,
  /\bwhsec_[A-Za-z0-9]+/gi,
  /\bya29\.[A-Za-z0-9._-]+/gi,
  /\b[A-Za-z0-9_-]{28,}\b/g,
];

export function redactSecrets(message: string): string {
  let redacted = message;
  for (const pattern of REDACTION_PATTERNS) redacted = redacted.replace(pattern, "[REDACTED]");
  return redacted;
}

function classifyError(message: string, statusCode?: number): IntegrationErrorCategory {
  if (statusCode === 401 || statusCode === 403 || /unauthorized|invalid.*(token|credential)|forbidden/i.test(message)) return "auth";
  if (statusCode === 429 || /rate.?limit/i.test(message)) return "rate_limit";
  if (statusCode === 404 || /not.?found/i.test(message)) return "not_found";
  if (statusCode === 400 || statusCode === 422 || /invalid|validation/i.test(message)) return "validation";
  if (/network|timeout|econnrefused|fetch failed/i.test(message)) return "network";
  if (statusCode !== undefined && statusCode >= 500) return "provider_unavailable";
  return "unknown";
}

const RETRYABLE_CATEGORIES: IntegrationErrorCategory[] = ["rate_limit", "network", "provider_unavailable"];

export function sanitizeIntegrationError(params: { connectionId: string; providerId: string; rawMessage: string; statusCode?: number }): IntegrationErrorRecord {
  const category = classifyError(params.rawMessage, params.statusCode);
  return {
    id: generateErrorRecordId(),
    connection_id: params.connectionId,
    provider_id: params.providerId,
    category,
    message: redactSecrets(params.rawMessage).slice(0, 500),
    occurred_at: nowIso(),
    retryable: RETRYABLE_CATEGORIES.includes(category),
  };
}

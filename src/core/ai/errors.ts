/**
 * One shared error taxonomy for everything AI — the Runtime produces
 * `timeout`/`provider_failure`/`unavailable_provider`/`fallback_exhausted`;
 * the structured-output pipeline (`structuredOutput.ts`) produces
 * `malformed_output`/`schema_failure`/`semantic_failure`; the Tool Registry
 * (`tools/executeTool.ts`) produces `permission_denied`/`approval_required`.
 * Keeping them in one union means a caller handling "what went wrong" never
 * has to check a different error shape depending on which stage failed.
 */
export const AI_ERROR_CATEGORIES = [
  "malformed_output",
  "schema_failure",
  "semantic_failure",
  "provider_failure",
  "timeout",
  "unavailable_provider",
  "fallback_exhausted",
  "invalid_request",
  "permission_denied",
  "approval_required",
  "context_unavailable",
] as const;

export type AIErrorCategory = (typeof AI_ERROR_CATEGORIES)[number];

/**
 * `message` is always a fixed, safe, human-readable string — never derived
 * from a caught exception's own `.message` — since a provider's thrown
 * error could contain anything (connection strings, partial secrets). See
 * `runtime.ts`'s provider-failure handling for where this matters most.
 */
export interface AIError {
  category: AIErrorCategory;
  message: string;
}

/**
 * Validation/auth/malformed-request failures are never worth retrying —
 * retrying the exact same bad input, missing permission, or still-pending
 * approval just wastes a request against the same wall. Everything else
 * (timeouts, transient provider failures) is retryable by default.
 */
export function isRetryableCategory(category: AIErrorCategory): boolean {
  return (
    category !== "invalid_request" &&
    category !== "malformed_output" &&
    category !== "schema_failure" &&
    category !== "semantic_failure" &&
    category !== "permission_denied" &&
    category !== "approval_required" &&
    category !== "context_unavailable"
  );
}

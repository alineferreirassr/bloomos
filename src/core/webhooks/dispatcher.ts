import { signWebhookPayload, buildSignatureHeader, WEBHOOK_SIGNATURE_HEADER } from "@/lib/webhooks/signature";
import type { WebhookEndpoint } from "@/types/webhookEndpoint";
import type { WebhookEventEnvelope } from "@/types/webhookEvent";

/**
 * Checkpoint 17, Step 4 — the Dispatcher. This checkpoint's first real
 * outbound HTTP call anywhere in the codebase (every prior checkpoint's
 * `fetch()` calls were inbound Route Handlers or internal React Query
 * reads). A single delivery *attempt* — the Retry Engine (`retryEngine.ts`)
 * is the only caller, looping this as many times as its own backoff
 * policy calls for. Never throws: every failure mode (network error,
 * timeout, non-2xx status) is captured into the returned result, never an
 * unhandled rejection that could crash the caller — the same "isolate
 * failure into a safe result object" discipline `computeOne()`
 * (Checkpoint 15's Analytics Engine) already established for one broken
 * metric never breaking the rest of a dashboard.
 */
const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;
const USER_AGENT = "BloomOS-Webhooks/1.0";

export interface WebhookDispatchResult {
  success: boolean;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string> | null;
  responseBodyExcerpt: string | null;
}

const RESPONSE_BODY_EXCERPT_LENGTH = 500;

/**
 * Sends exactly one HTTP POST for the given already-serialized `body` —
 * callers that need to *replay* a prior delivery pass the literal stored
 * `request_body` string back in here unchanged, so a signature computed
 * over it verifies exactly the same way twice.
 */
export async function dispatchWebhookDelivery(endpoint: WebhookEndpoint, envelope: Pick<WebhookEventEnvelope, "id" | "event">, body: string): Promise<WebhookDispatchResult> {
  const timestampSeconds = Math.floor(Date.now() / 1000).toString();
  const signature = await signWebhookPayload(endpoint.secret, timestampSeconds, body);

  const requestHeaders: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "x-bloomos-event": envelope.event,
    "x-bloomos-delivery": envelope.id,
    [WEBHOOK_SIGNATURE_HEADER]: buildSignatureHeader(signature, timestampSeconds),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_DELIVERY_TIMEOUT_MS);
  const started = Date.now();

  try {
    const response = await fetch(endpoint.url, { method: "POST", headers: requestHeaders, body, signal: controller.signal });
    const durationMs = Date.now() - started;
    const responseBody = await response.text().catch(() => "");
    return {
      success: response.ok,
      statusCode: response.status,
      durationMs,
      error: response.ok ? null : `Endpoint responded with HTTP ${response.status}.`,
      requestHeaders,
      responseHeaders: Object.fromEntries(response.headers.entries()),
      responseBodyExcerpt: responseBody.slice(0, RESPONSE_BODY_EXCERPT_LENGTH) || null,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      statusCode: null,
      durationMs,
      error: isAbort ? `Request timed out after ${WEBHOOK_DELIVERY_TIMEOUT_MS}ms.` : error instanceof Error ? error.message : "Unknown delivery error.",
      requestHeaders,
      responseHeaders: null,
      responseBodyExcerpt: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

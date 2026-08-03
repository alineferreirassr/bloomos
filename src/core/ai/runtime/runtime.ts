import { randomUUID } from "node:crypto";
import { selectAIProviders } from "@/core/ai/providerRegistry";
import { isRetryableCategory, type AIError, type AIErrorCategory } from "@/core/ai/errors";
import { computeBackoffDelayMs } from "@/core/ai/runtime/retry";
import { getLogger } from "@/core/observability/logger";
import type { AIRuntimeRequest, AIRuntimeResult } from "@/core/ai/runtime/types";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 0;
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("__ai_runtime_timeout__")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The single execution seam every AI use case should call — never a
 * provider's `.complete()` directly. Centralizes provider selection,
 * timeout, bounded retry-with-backoff, provider-to-provider fallback, and
 * safe structured logging so no feature reimplements any of it.
 *
 * `sleepFn` exists only so tests can make retry delays instant — production
 * callers never pass it.
 */
export async function executeAIRequest(request: AIRuntimeRequest, sleepFn: (ms: number) => Promise<void> = defaultSleep): Promise<AIRuntimeResult> {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = request.maxRetries ?? DEFAULT_MAX_RETRIES;

  const candidates = request.provider
    ? [{ id: request.provider.name, provider: request.provider }]
    : selectAIProviders({
        requiredCapabilities: request.requiredCapabilities,
        preferredProviderId: request.preferredProviderId,
        fallbackProviderIds: request.fallbackProviderIds,
      }).map((entry) => ({ id: entry.id, provider: entry.provider }));

  if (candidates.length === 0) {
    const error: AIError = { category: "unavailable_provider", message: "No AI provider is currently available for this request." };
    getLogger().error("AI request has no eligible provider", { requestId, useCaseId: request.useCaseId });
    return { success: false, error, metadata: { requestId, attempts: 0, latencyMs: Date.now() - startedAt } };
  }

  let totalAttempts = 0;
  let lastError: AIError = { category: "unavailable_provider", message: "No AI provider is currently available for this request." };

  for (const candidate of candidates) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      try {
        const completion = await withTimeout(candidate.provider.complete(request.completionRequest), timeoutMs);

        if (completion.finishReason === "error") {
          lastError = { category: "provider_failure", message: "The AI provider returned an error." };
          getLogger().warn("AI provider returned an error completion", {
            requestId,
            providerId: candidate.id,
            useCaseId: request.useCaseId,
            attempt,
          });
          break; // a deliberate provider refusal — not worth retrying against the same provider
        }

        getLogger().info("AI request completed", {
          requestId,
          providerId: candidate.id,
          useCaseId: request.useCaseId,
          attempts: totalAttempts,
          latencyMs: Date.now() - startedAt,
        });
        return {
          success: true,
          completion,
          metadata: { requestId, providerId: candidate.id, attempts: totalAttempts, latencyMs: Date.now() - startedAt },
        };
      } catch (error) {
        const timedOut = error instanceof Error && error.message === "__ai_runtime_timeout__";
        const category: AIErrorCategory = timedOut ? "timeout" : "provider_failure";
        lastError = { category, message: timedOut ? "The AI request timed out." : "The AI provider call failed." };

        // Never include the caught error's own message — it may originate
        // from a third-party provider and could contain connection details
        // or partial secrets (see docs/v2-checkpoint-2-bloom-ai-platform.md).
        getLogger().warn("AI provider attempt failed", { requestId, providerId: candidate.id, useCaseId: request.useCaseId, attempt, category });

        if (!isRetryableCategory(category) || attempt === maxRetries) break;
        await sleepFn(computeBackoffDelayMs(attempt, BASE_BACKOFF_MS, MAX_BACKOFF_MS));
      }
    }
  }

  const finalCategory: AIErrorCategory = candidates.length > 1 ? "fallback_exhausted" : lastError.category;
  getLogger().error("AI request failed after exhausting all candidates", {
    requestId,
    useCaseId: request.useCaseId,
    attempts: totalAttempts,
    category: finalCategory,
  });

  return {
    success: false,
    error: { category: finalCategory, message: lastError.message },
    metadata: { requestId, attempts: totalAttempts, latencyMs: Date.now() - startedAt },
  };
}

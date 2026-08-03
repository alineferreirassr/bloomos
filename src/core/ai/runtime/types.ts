import type { AICapability } from "@/core/ai/capabilities";
import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { AIError } from "@/core/ai/errors";

/**
 * `provider`, when given, skips selection entirely and executes against
 * exactly that provider (still gaining timeout/retry/observability) — this
 * is how the migrated Event Operations Brief preserves its own, already-
 * resolved `getAIProvider() ?? createMockAIProvider()` call site instead of
 * going through registry-based selection, since that resolution is what its
 * existing test suite mocks directly. New use cases going forward should
 * prefer `requiredCapabilities`/`preferredProviderId`/`fallbackProviderIds`
 * and let the Runtime select via the registry.
 */
export interface AIRuntimeRequest {
  provider?: AIProvider;
  requiredCapabilities?: AICapability[];
  preferredProviderId?: string;
  fallbackProviderIds?: string[];
  completionRequest: AICompletionRequest;
  /** Defaults to 20s — the exact value the pre-platform Event Operations Brief always used. */
  timeoutMs?: number;
  /** Defaults to 0 (no retry) — set explicitly per use case; the migrated Event Brief keeps 0 to preserve its exact v1 behavior. */
  maxRetries?: number;
  /** For observability only — never influences execution. */
  useCaseId?: string;
}

export interface AIRuntimeExecutionMetadata {
  requestId: string;
  providerId: string;
  attempts: number;
  latencyMs: number;
  tokenUsage?: { inputTokens?: number; outputTokens?: number };
}

export type AIRuntimeResult =
  | { success: true; completion: AICompletion; metadata: AIRuntimeExecutionMetadata }
  | { success: false; error: AIError; metadata: { requestId: string; attempts: number; latencyMs: number } };

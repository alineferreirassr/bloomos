import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeAIRequest } from "@/core/ai/runtime/runtime";
import { registerAIProviderEntry, resetAIProviderRegistry, setDefaultAIProviderId } from "@/core/ai/providerRegistry";
import { getLogger, setLogger, consoleLogger } from "@/core/observability/logger";
import type { AIProvider, AICompletion, AICompletionRequest } from "@/core/ai/types";

const noopLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
const instantSleep = async () => {};

function stubCompletionRequest(): AICompletionRequest {
  const now = new Date().toISOString();
  return {
    conversation: { id: "conv-1", workspaceId: "ws-1", context: { workspaceId: "ws-1", ownerType: "event", ownerId: "e-1", facts: {} }, messages: [], createdAt: now, updatedAt: now },
    prompt: { role: "user", content: "hello" },
  };
}

function okCompletion(content = "ok"): AICompletion {
  return { content, requiresApproval: true, model: "stub-model", finishReason: "stop" };
}

describe("executeAIRequest", () => {
  beforeEach(() => setLogger(noopLogger));
  afterEach(() => {
    resetAIProviderRegistry();
    setLogger(consoleLogger);
    vi.restoreAllMocks();
  });

  it("executes directly against a pre-resolved provider, bypassing registry selection", async () => {
    const complete = vi.fn().mockResolvedValue(okCompletion());
    const provider: AIProvider = { name: "direct", complete };

    const result = await executeAIRequest({ provider, completionRequest: stubCompletionRequest() }, instantSleep);

    expect(result.success).toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.metadata.providerId).toBe("direct");
      expect(result.metadata.attempts).toBe(1);
    }
  });

  it("returns unavailable_provider with zero attempts when no candidate is eligible", async () => {
    const result = await executeAIRequest({ completionRequest: stubCompletionRequest() }, instantSleep);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe("unavailable_provider");
      expect(result.metadata.attempts).toBe(0);
    }
  });

  it("selects via the registry using preferred/fallback/default when no provider is pre-resolved", async () => {
    const complete = vi.fn().mockResolvedValue(okCompletion());
    registerAIProviderEntry({ id: "chosen", provider: { name: "chosen", complete }, capabilities: ["text_generation"] });

    const result = await executeAIRequest(
      { requiredCapabilities: ["text_generation"], preferredProviderId: "chosen", completionRequest: stubCompletionRequest() },
      instantSleep,
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.metadata.providerId).toBe("chosen");
  });

  it("retries a timed-out call up to maxRetries, then falls back to the next candidate on success", async () => {
    const flaky = vi.fn().mockImplementation(() => new Promise<AICompletion>((resolve) => setTimeout(() => resolve(okCompletion()), 50)));
    const reliable = vi.fn().mockResolvedValue(okCompletion("from-reliable"));
    registerAIProviderEntry({ id: "flaky", provider: { name: "flaky", complete: flaky }, capabilities: [] });
    registerAIProviderEntry({ id: "reliable", provider: { name: "reliable", complete: reliable }, capabilities: [] });

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const result = await executeAIRequest(
      { preferredProviderId: "flaky", fallbackProviderIds: ["reliable"], timeoutMs: 5, maxRetries: 1, completionRequest: stubCompletionRequest() },
      sleepFn,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.providerId).toBe("reliable");
      // 2 attempts against "flaky" (initial + 1 retry) + 1 against "reliable"
      expect(result.metadata.attempts).toBe(3);
    }
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it("computes backoff delay from computeBackoffDelayMs (base * 2^attempt, capped)", async () => {
    const alwaysTimesOut = vi.fn().mockImplementation(() => new Promise<AICompletion>((resolve) => setTimeout(() => resolve(okCompletion()), 50)));
    registerAIProviderEntry({ id: "slow", provider: { name: "slow", complete: alwaysTimesOut }, capabilities: [] });

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    await executeAIRequest({ preferredProviderId: "slow", timeoutMs: 5, maxRetries: 2, completionRequest: stubCompletionRequest() }, sleepFn);

    expect(sleepFn).toHaveBeenCalledTimes(2);
    expect(sleepFn.mock.calls[0][0]).toBe(250);
    expect(sleepFn.mock.calls[1][0]).toBe(500);
  });

  it("does not retry a deliberate provider error completion (finishReason: 'error')", async () => {
    const complete = vi.fn().mockResolvedValue({ content: "", requiresApproval: true, model: "stub", finishReason: "error" as const });
    registerAIProviderEntry({ id: "refusing", provider: { name: "refusing", complete }, capabilities: [] });

    const result = await executeAIRequest({ preferredProviderId: "refusing", maxRetries: 3, completionRequest: stubCompletionRequest() }, instantSleep);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("provider_failure");
  });

  it("uses fallback_exhausted only when more than one candidate was tried", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    registerAIProviderEntry({ id: "only", provider: { name: "only", complete: failing }, capabilities: [] });

    const singleResult = await executeAIRequest({ preferredProviderId: "only", completionRequest: stubCompletionRequest() }, instantSleep);
    expect(singleResult.success).toBe(false);
    if (!singleResult.success) expect(singleResult.error.category).toBe("provider_failure");

    registerAIProviderEntry({ id: "second", provider: { name: "second", complete: failing }, capabilities: [] });
    const multiResult = await executeAIRequest(
      { preferredProviderId: "only", fallbackProviderIds: ["second"], completionRequest: stubCompletionRequest() },
      instantSleep,
    );
    expect(multiResult.success).toBe(false);
    if (!multiResult.success) expect(multiResult.error.category).toBe("fallback_exhausted");
  });

  it("never leaks the caught error's own message into the returned error or logs", async () => {
    const secretError = new Error("connection reset by peer, secret_key=sk-abc123");
    const complete = vi.fn().mockRejectedValue(secretError);
    registerAIProviderEntry({ id: "leaky", provider: { name: "leaky", complete }, capabilities: [] });

    const logSpy = vi.fn();
    setLogger({ debug: logSpy, info: logSpy, warn: logSpy, error: logSpy });

    const result = await executeAIRequest({ preferredProviderId: "leaky", completionRequest: stubCompletionRequest() }, instantSleep);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).not.toContain("secret_key");
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("secret_key");
    }
  });

  it("distinguishes a timeout from other provider failures", async () => {
    const hangs = vi.fn().mockImplementation(() => new Promise<AICompletion>(() => {}));
    registerAIProviderEntry({ id: "hangs", provider: { name: "hangs", complete: hangs }, capabilities: [] });

    const result = await executeAIRequest({ preferredProviderId: "hangs", timeoutMs: 5, completionRequest: stubCompletionRequest() }, instantSleep);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.category).toBe("timeout");
  });

  it("logs a safe, structured info line with providerId and useCaseId on success", async () => {
    const logSpy = vi.fn();
    setLogger({ ...noopLogger, info: logSpy });
    const complete = vi.fn().mockResolvedValue(okCompletion());
    registerAIProviderEntry({ id: "primary", provider: { name: "primary", complete }, capabilities: [] });
    setDefaultAIProviderId("primary");

    await executeAIRequest({ useCaseId: "event-operations-brief", completionRequest: stubCompletionRequest() }, instantSleep);

    expect(logSpy).toHaveBeenCalledWith(
      "AI request completed",
      expect.objectContaining({ providerId: "primary", useCaseId: "event-operations-brief" }),
    );
    expect(getLogger()).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import { registerAIProvider, getAIProvider, isAIConfigured } from "@/core/ai/registry";
import type { AIProvider } from "@/core/ai/types";

describe("AI provider registry", () => {
  it("has no provider configured by default", () => {
    expect(isAIConfigured()).toBe(false);
    expect(getAIProvider()).toBeUndefined();
  });

  it("registers a provider and makes it retrievable", () => {
    const provider: AIProvider = {
      name: "stub",
      complete: async () => ({ content: "ok", requiresApproval: true, model: "stub-1", finishReason: "stop" }),
    };
    registerAIProvider(provider);

    expect(isAIConfigured()).toBe(true);
    expect(getAIProvider()).toBe(provider);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerAIUseCase, getAIUseCase, listAIUseCases, resetAIUseCaseRegistry } from "@/core/ai/prompts/registry";
import { routeAIUseCase } from "@/core/ai/prompts/router";
import type { AIUseCaseDefinition } from "@/core/ai/prompts/types";

function stubUseCase(useCaseId: string): AIUseCaseDefinition {
  return {
    useCaseId,
    promptVersion: "v1",
    systemInstructions: "You are Bloom AI.",
    buildMessages: () => [{ role: "user", content: "hello" }],
    outputSchema: z.object({ summary: z.string() }),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 4000, reservedOutputTokens: 500 },
    humanApprovalPolicy: "always_required",
  };
}

describe("AI use case registry", () => {
  afterEach(() => resetAIUseCaseRegistry());

  it("registers and retrieves a use case by id", () => {
    registerAIUseCase(stubUseCase("event-operations-brief"));
    expect(getAIUseCase("event-operations-brief")?.promptVersion).toBe("v1");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getAIUseCase("unregistered")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerAIUseCase(stubUseCase("brief"));
    registerAIUseCase({ ...stubUseCase("brief"), promptVersion: "v2" });
    expect(listAIUseCases()).toHaveLength(1);
    expect(getAIUseCase("brief")?.promptVersion).toBe("v2");
  });

  it("lists every registered use case", () => {
    registerAIUseCase(stubUseCase("a"));
    registerAIUseCase(stubUseCase("b"));
    expect(listAIUseCases().map((useCase) => useCase.useCaseId).sort()).toEqual(["a", "b"]);
  });
});

describe("routeAIUseCase", () => {
  afterEach(() => resetAIUseCaseRegistry());

  it("resolves a registered use case", () => {
    registerAIUseCase(stubUseCase("event-operations-brief"));
    const result = routeAIUseCase("event-operations-brief");
    expect(result.success).toBe(true);
    if (result.success) expect(result.useCase.useCaseId).toBe("event-operations-brief");
  });

  it("returns a typed invalid_request error for an unregistered use case", () => {
    const result = routeAIUseCase("does-not-exist");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.category).toBe("invalid_request");
      expect(result.error.message).toContain("does-not-exist");
    }
  });
});

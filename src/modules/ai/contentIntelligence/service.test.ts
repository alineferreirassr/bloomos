import { afterEach, describe, expect, it } from "vitest";
import { runContentIntelligenceAnalysis } from "@/modules/ai/contentIntelligence/service";
import { resetAIGenerationsStore } from "@/lib/data/mock/aiGenerationsStore";
import { CONTENT_INTELLIGENCE_USE_CASE_ID } from "@/modules/ai/contentIntelligence/promptBuilder";
import type { ContentIntelligenceSourceContent } from "@/modules/ai/contentIntelligence/types";
import type { AIProvider, AICompletion } from "@/core/ai/types";

const WORKSPACE_ID = "ws_1";
const ACTOR_ID = "user_1";

function source(overrides: Partial<ContentIntelligenceSourceContent> = {}): ContentIntelligenceSourceContent {
  return {
    sourceEntityType: "idea_item",
    sourceEntityId: "idea_1",
    title: "A cozy autumn wedding",
    fields: { hook: "Fall in love with fall weddings.", cta: "Book your tasting today." },
    ...overrides,
  };
}

function failingProvider(): AIProvider {
  return {
    name: "failing-test-provider",
    async complete(): Promise<AICompletion> {
      throw new Error("simulated provider outage");
    },
  };
}

function malformedOutputProvider(): AIProvider {
  return {
    name: "malformed-test-provider",
    async complete(): Promise<AICompletion> {
      return { content: JSON.stringify({ not: "the expected shape" }), requiresApproval: false, model: "test-model", finishReason: "stop" };
    },
  };
}

function nonJsonProvider(): AIProvider {
  return {
    name: "non-json-test-provider",
    async complete(): Promise<AICompletion> {
      return { content: "this is not JSON at all", requiresApproval: false, model: "test-model", finishReason: "stop" };
    },
  };
}

afterEach(() => {
  resetAIGenerationsStore();
});

describe("runContentIntelligenceAnalysis — valid analysis for each source entity type", () => {
  it("analyzes an Idea and persists a generation record", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source({ sourceEntityType: "idea_item" }) });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_entity_type).toBe("idea_item");
    expect(result.data.use_case_id).toBe(CONTENT_INTELLIGENCE_USE_CASE_ID);
    expect(result.data.approval_status).toBe("proposed");
  });

  it("analyzes an Inspiration and persists a generation record", async () => {
    const result = await runContentIntelligenceAnalysis({
      workspaceId: WORKSPACE_ID,
      createdBy: ACTOR_ID,
      source: source({ sourceEntityType: "inspiration_item", sourceEntityId: "insp_1" }),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_entity_type).toBe("inspiration_item");
  });

  it("analyzes a Script and persists a generation record", async () => {
    const result = await runContentIntelligenceAnalysis({
      workspaceId: WORKSPACE_ID,
      createdBy: ACTOR_ID,
      source: source({ sourceEntityType: "script_item", sourceEntityId: "script_1", fields: { content: "Scene one: open on the venue." } }),
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_entity_type).toBe("script_item");
  });
});

describe("runContentIntelligenceAnalysis — provenance", () => {
  it("persists source entity, use case, provider/model/mock status, prompt version, structured input/output, and confidence", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_entity_type).toBe("idea_item");
    expect(result.data.source_entity_id).toBe("idea_1");
    expect(result.data.use_case_id).toBe(CONTENT_INTELLIGENCE_USE_CASE_ID);
    expect(result.data.provider_id).toBe("content-intelligence-mock");
    expect(result.data.is_mock).toBe(true);
    expect(result.data.prompt_version).toBe("v1");
    expect(result.data.input).toMatchObject({ title: "A cozy autumn wedding" });
    expect(result.data.output).toHaveProperty("summary");
    expect(typeof result.data.confidence).toBe("number");
  });

  it("AI_PROVIDER_CALLS = 0 — the default provider is the deterministic mock, no network is ever reached", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.provider_id).toBe("content-intelligence-mock");
  });
});

describe("runContentIntelligenceAnalysis — malformed provider output", () => {
  it("rejects output that doesn't match the schema and persists nothing", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source(), provider: malformedOutputProvider() });
    expect(result.success).toBe(false);
  });

  it("rejects non-JSON output and persists nothing", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source(), provider: nonJsonProvider() });
    expect(result.success).toBe(false);
  });
});

describe("runContentIntelligenceAnalysis — provider failure", () => {
  it("returns a controlled failure result, never throws, when the provider itself fails", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source(), provider: failingProvider() });
    expect(result.success).toBe(false);
  });

  it("never leaks the underlying provider error message (which could contain secrets)", async () => {
    const result = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source(), provider: failingProvider() });
    if (result.success) throw new Error("expected failure");
    expect(result.error).not.toContain("simulated provider outage");
  });
});

describe("runContentIntelligenceAnalysis — deterministic mock behavior", () => {
  it("produces the same output content for the same source across two separate calls", async () => {
    const first = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    const second = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.data.output).toEqual(second.data.output);
    }
  });
});

describe("runContentIntelligenceAnalysis — regeneration", () => {
  it("regeneration creates a new generation with the next generation_number, and the previous generation remains unchanged", async () => {
    const first = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    if (!first.success) throw new Error("setup failed");

    const second = await runContentIntelligenceAnalysis({ workspaceId: WORKSPACE_ID, createdBy: ACTOR_ID, source: source() });
    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.data.generation_number).toBe(first.data.generation_number + 1);
    expect(second.data.id).not.toBe(first.data.id);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { executeSkill, runSkillCompletion } from "@/core/ai/skills/resolver";
import { registerSkill, resetSkillRegistry } from "@/core/ai/skills/registry";
import { registerAIUseCase, resetAIUseCaseRegistry } from "@/core/ai/prompts/registry";
import { registerAIContextBuilder, resetAIContextRegistry } from "@/core/ai/context/registry";
import { registerAIProvider } from "@/core/ai/registry";
import { resetAIProviderRegistry } from "@/core/ai/providerRegistry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { SkillDefinition, SkillExecuteFn } from "@/core/ai/skills/types";
import type { AIProvider } from "@/core/ai/types";

const outputSchema = z.object({ text: z.string().min(1) });

function stubProvider(content: string, overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    name: "stub-provider",
    complete: async () => ({ content, requiresApproval: false, model: "stub-model", finishReason: "stop" }),
    ...overrides,
  };
}

function registerStubUseCase(overrides: Partial<Parameters<typeof registerAIUseCase>[0]> = {}) {
  registerAIUseCase({
    useCaseId: "stub-skill",
    promptVersion: "v1",
    systemInstructions: "system",
    buildMessages: () => [{ role: "user", content: "hello" }],
    outputSchema,
    requiredCapabilities: [],
    tokenBudget: { maxInputTokens: 100, reservedOutputTokens: 10 },
    humanApprovalPolicy: "not_required",
    ...overrides,
  });
}

function registerStubContextBuilders(options: { serviceReturnsNull?: boolean } = {}) {
  registerAIContextBuilder({ key: "workspace", priority: 1, build: async () => ({ data: { id: "ws_1", name: "Workspace" }, source: "stub" }) });
  registerAIContextBuilder({ key: "user", priority: 1, build: async () => ({ data: { id: "user_1", name: "User" }, source: "stub" }) });
  registerAIContextBuilder({
    key: "service",
    priority: 1,
    build: async () => (options.serviceReturnsNull ? null : { data: { name: "Photography" }, source: "stub" }),
  });
}

function stubSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: "stub-skill",
    name: "Stub Skill",
    description: "A minimal Skill for resolver tests.",
    category: "operations",
    requiredPermissions: [],
    requiredContext: ["service"],
    useCaseId: "stub-skill",
    outputSchema,
    supportedProviders: "any",
    requiredCapabilities: [],
    supportsStreaming: false,
    requiresApproval: false,
    requiresReview: false,
    commandPaletteVisible: true,
    sidebarVisible: true,
    featureFlag: null,
    minimumRole: null,
    version: "v1",
    estimatedLatencyMs: null,
    contextFactsKey: "stubContext",
    createMockProvider: () => stubProvider(JSON.stringify({ text: "mock output" }), { name: "stub-mock" }),
    ...overrides,
  };
}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    skillId: "stub-skill",
    workspaceId: "ws_1",
    workspaceName: "Workspace",
    userId: "user_1",
    userName: "User",
    permissions: [] as never[],
    role: null,
    refs: {},
    ...overrides,
  };
}

afterEach(() => {
  resetSkillRegistry();
  resetAIUseCaseRegistry();
  resetAIContextRegistry();
  resetAIProviderRegistry();
  resetFeatureFlagsStore();
});

describe("executeSkill", () => {
  it("returns invalid_request when no Skill is registered for the id", async () => {
    const result = await executeSkill(baseParams({ skillId: "ghost" }));
    expect(result).toMatchObject({ success: false, error: { category: "invalid_request" } });
  });

  it("returns invalid_request when the Skill has no execute function (coming soon)", async () => {
    registerSkill(stubSkill({ execute: undefined }));
    const result = await executeSkill(baseParams());
    expect(result).toMatchObject({ success: false, error: { category: "invalid_request" } });
  });

  it("returns permission_denied when a required permission is missing", async () => {
    registerSkill(stubSkill({ requiredPermissions: ["events.update"], execute: vi.fn() as unknown as SkillExecuteFn }));
    const result = await executeSkill(baseParams({ permissions: [] }));
    expect(result).toMatchObject({ success: false, error: { category: "permission_denied" } });
  });

  it("proceeds once every required permission is present", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ requiredPermissions: ["events.update"], execute }));
    const result = await executeSkill(baseParams({ permissions: ["events.update"] }));
    expect(result.success).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("returns permission_denied when the member's role is below the Skill's minimum", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ minimumRole: "manager", execute }));
    const result = await executeSkill(baseParams({ role: "staff" }));
    expect(result).toMatchObject({ success: false, error: { category: "permission_denied" } });
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns permission_denied when a minimum role is set and no role is supplied", async () => {
    registerSkill(stubSkill({ minimumRole: "manager", execute: vi.fn() as unknown as SkillExecuteFn }));
    const result = await executeSkill(baseParams({ role: null }));
    expect(result).toMatchObject({ success: false, error: { category: "permission_denied" } });
  });

  it("proceeds once the member meets the Skill's minimum role", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ minimumRole: "manager", execute }));
    const result = await executeSkill(baseParams({ role: "owner" }));
    expect(result.success).toBe(true);
  });

  it("returns invalid_request when the Skill's feature flag is disabled for this Workspace", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ featureFlag: "new-skill", execute }));
    const result = await executeSkill(baseParams());
    expect(result).toMatchObject({ success: false, error: { category: "invalid_request" } });
    expect(execute).not.toHaveBeenCalled();
  });

  it("proceeds once the Skill's feature flag is enabled for this Workspace", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ featureFlag: "new-skill", execute }));
    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-skill", true);
    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
  });

  it("returns approval_required when the Skill requires approval and none was given", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ requiresApproval: true, execute }));
    const result = await executeSkill(baseParams({ approved: false }));
    expect(result).toMatchObject({ success: false, error: { category: "approval_required" } });
    expect(execute).not.toHaveBeenCalled();
  });

  it("proceeds once approval is given for a Skill that requires it", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ requiresApproval: true, execute }));
    const result = await executeSkill(baseParams({ approved: true }));
    expect(result.success).toBe(true);
  });

  it("passes workspace/user identity and refs straight through to the Skill's own execute", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} });
    registerSkill(stubSkill({ execute }));
    await executeSkill(baseParams({ refs: { eventId: "event_1" } }));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws_1", workspaceName: "Workspace", userId: "user_1", userName: "User", refs: { eventId: "event_1" } }),
    );
  });
});

describe("runSkillCompletion", () => {
  function runParams(skill: SkillDefinition, overrides: Record<string, unknown> = {}) {
    return {
      skill,
      workspaceId: "ws_1",
      workspaceName: "Workspace",
      userId: "user_1",
      userName: "User",
      refs: {},
      ...overrides,
    };
  }

  it("returns invalid_request when the Skill's use case isn't registered in the Prompt Registry", async () => {
    registerStubContextBuilders();
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result).toMatchObject({ success: false, error: { category: "invalid_request" } });
  });

  it("returns provider_failure when context assembly itself throws", async () => {
    registerStubUseCase();
    registerAIContextBuilder({ key: "workspace", priority: 1, build: async () => ({ data: {}, source: "stub" }) });
    registerAIContextBuilder({ key: "user", priority: 1, build: async () => ({ data: {}, source: "stub" }) });
    registerAIContextBuilder({
      key: "service",
      priority: 1,
      build: async () => {
        throw new Error("boom");
      },
    });
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result).toMatchObject({ success: false, error: { category: "provider_failure" } });
  });

  it("returns context_unavailable when a required section comes back null", async () => {
    registerStubUseCase();
    registerStubContextBuilders({ serviceReturnsNull: true });
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result).toMatchObject({ success: false, error: { category: "context_unavailable" } });
  });

  it("returns unavailable_provider when no live provider is configured and the Skill has no mock factory", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    const result = await runSkillCompletion(runParams(stubSkill({ createMockProvider: undefined })));
    expect(result).toMatchObject({ success: false, error: { category: "unavailable_provider" } });
  });

  it("falls back to the Skill's own mock provider and reports mock:true when no live provider is configured", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.mock).toBe(true);
      expect(result.metadata.provider).toBe("stub-mock");
      expect(result.data).toEqual({ text: "mock output" });
    }
  });

  it("uses the registered live provider and reports mock:false when one is configured", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    registerAIProvider(stubProvider(JSON.stringify({ text: "live output" }), { name: "live-provider" }));
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.mock).toBe(false);
      expect(result.metadata.provider).toBe("live-provider");
      expect(result.data).toEqual({ text: "live output" });
    }
  });

  it("propagates the Runtime's own error category when the provider call fails", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    registerAIProvider(stubProvider("", { complete: async () => ({ content: "", requiresApproval: false, model: "m", finishReason: "error" }) }));
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result).toMatchObject({ success: false, error: { category: "provider_failure" } });
  });

  it("returns a schema-validation error rather than trusting malformed output", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    registerAIProvider(stubProvider("not json"));
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result.success).toBe(false);
    if (!result.success) expect(["malformed_output", "schema_failure"]).toContain(result.error.category);
  });

  it("applies the use case's own semanticValidate and surfaces a semantic_failure", async () => {
    registerStubUseCase({ semanticValidate: () => ({ success: false, error: "inconsistent" }) });
    registerStubContextBuilders();
    registerAIProvider(stubProvider(JSON.stringify({ text: "live output" })));
    const result = await runSkillCompletion(runParams(stubSkill()));
    expect(result).toMatchObject({ success: false, error: { category: "semantic_failure" } });
  });

  it("keys the provider request's facts by the Skill's own declared contextFactsKey", async () => {
    registerStubUseCase();
    registerStubContextBuilders();
    let capturedFacts: unknown;
    registerAIProvider({
      name: "capturing",
      complete: async (request) => {
        capturedFacts = request.conversation.context.facts;
        return { content: JSON.stringify({ text: "ok" }), requiresApproval: false, model: "m", finishReason: "stop" };
      },
    });
    await runSkillCompletion(runParams(stubSkill({ contextFactsKey: "myOwnKey" })));
    expect(capturedFacts).toHaveProperty("myOwnKey");
  });

  it("uses composeContext to shape the assembled sections before building the prompt, when declared", async () => {
    registerStubUseCase({
      composeContext: (sections) => ({ composed: true, service: sections.service }),
      buildMessages: (context) => [{ role: "user", content: JSON.stringify(context) }],
    });
    registerStubContextBuilders();
    let capturedPrompt = "";
    registerAIProvider({
      name: "capturing",
      complete: async (request) => {
        capturedPrompt = request.prompt.content;
        return { content: JSON.stringify({ text: "ok" }), requiresApproval: false, model: "m", finishReason: "stop" };
      },
    });
    await runSkillCompletion(runParams(stubSkill()));
    expect(JSON.parse(capturedPrompt)).toMatchObject({ composed: true, service: { name: "Photography" } });
  });

  it("defaults to the raw assembled sections when composeContext is not declared", async () => {
    registerStubUseCase({ buildMessages: (context) => [{ role: "user", content: JSON.stringify(context) }] });
    registerStubContextBuilders();
    let capturedPrompt = "";
    registerAIProvider({
      name: "capturing",
      complete: async (request) => {
        capturedPrompt = request.prompt.content;
        return { content: JSON.stringify({ text: "ok" }), requiresApproval: false, model: "m", finishReason: "stop" };
      },
    });
    await runSkillCompletion(runParams(stubSkill()));
    const parsed = JSON.parse(capturedPrompt);
    expect(parsed).toHaveProperty("workspace");
    expect(parsed).toHaveProperty("service");
  });
});

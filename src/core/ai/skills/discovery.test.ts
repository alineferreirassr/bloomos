import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerSkill, resetSkillRegistry } from "@/core/ai/skills/registry";
import { listSkillsForWorkspace, getSkillMetadata } from "@/core/ai/skills/discovery";
import { registerAIUseCase, resetAIUseCaseRegistry } from "@/core/ai/prompts/registry";
import { registerAIProvider } from "@/core/ai/registry";
import { resetAIProviderRegistry } from "@/core/ai/providerRegistry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { SkillDefinition } from "@/core/ai/skills/types";
import type { AIProvider } from "@/core/ai/types";

function stubSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: "stub-skill",
    name: "Stub Skill",
    description: "A minimal Skill for discovery tests.",
    category: "operations",
    requiredPermissions: [],
    requiredContext: [],
    useCaseId: "stub-skill",
    outputSchema: z.unknown(),
    supportedProviders: "any",
    requiredCapabilities: ["structured_output"],
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
    execute: async () => ({ success: true, data: {}, context: {}, metadata: { skillId: "stub-skill", useCaseId: "stub-skill", provider: "mock", model: "m", promptVersion: "v1", mock: true, latencyMs: 1, generatedAt: "2026-01-01T00:00:00.000Z" } }),
    ...overrides,
  };
}

afterEach(() => {
  resetSkillRegistry();
  resetAIUseCaseRegistry();
  resetAIProviderRegistry();
  resetFeatureFlagsStore();
});

describe("listSkillsForWorkspace", () => {
  it("includes a Skill with no permission/role/feature-flag restrictions", async () => {
    registerSkill(stubSkill());
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result.map((skill) => skill.id)).toEqual(["stub-skill"]);
  });

  it("excludes a Skill requiring a permission the member lacks", async () => {
    registerSkill(stubSkill({ requiredPermissions: ["events.update"] }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result).toEqual([]);
  });

  it("includes a Skill once every required permission is present", async () => {
    registerSkill(stubSkill({ requiredPermissions: ["events.update"] }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: ["events.update"], role: null });
    expect(result.map((skill) => skill.id)).toEqual(["stub-skill"]);
  });

  it("excludes a Skill below its minimum role", async () => {
    registerSkill(stubSkill({ minimumRole: "manager" }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "staff" });
    expect(result).toEqual([]);
  });

  it("excludes a Skill with a minimum role when the member has no role at all", async () => {
    registerSkill(stubSkill({ minimumRole: "manager" }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result).toEqual([]);
  });

  it("includes a Skill once the member meets its minimum role", async () => {
    registerSkill(stubSkill({ minimumRole: "manager" }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(result.map((skill) => skill.id)).toEqual(["stub-skill"]);
  });

  it("excludes a Skill gated by a disabled feature flag", async () => {
    registerSkill(stubSkill({ featureFlag: "new-skill" }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result).toEqual([]);
  });

  it("includes a Skill once its feature flag is enabled for this Workspace", async () => {
    registerSkill(stubSkill({ featureFlag: "new-skill" }));
    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-skill", true);
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result.map((skill) => skill.id)).toEqual(["stub-skill"]);
  });

  it("does not leak a feature flag enabled for a different Workspace", async () => {
    registerSkill(stubSkill({ featureFlag: "new-skill" }));
    await getCoreFeatureFlagsService().setFeatureFlag("ws_other", "new-skill", true);
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result).toEqual([]);
  });

  it("sorts results alphabetically by name for a stable order", async () => {
    registerSkill(stubSkill({ id: "b", name: "Bravo" }));
    registerSkill(stubSkill({ id: "a", name: "Alpha" }));
    const result = await listSkillsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(result.map((skill) => skill.id)).toEqual(["a", "b"]);
  });
});

describe("getSkillMetadata", () => {
  it("returns null for an unregistered Skill id", () => {
    expect(getSkillMetadata("missing")).toBeNull();
  });

  it("reports status 'coming_soon' and availability 'unavailable' for a Skill with no execute function", () => {
    registerSkill(stubSkill({ execute: undefined }));
    const metadata = getSkillMetadata("stub-skill");
    expect(metadata?.status).toBe("coming_soon");
    expect(metadata?.availability).toBe("unavailable");
    expect(metadata?.provider).toBeNull();
  });

  it("reports status 'active' and availability 'mock' for an executable Skill with no live provider configured", () => {
    registerSkill(stubSkill());
    const metadata = getSkillMetadata("stub-skill");
    expect(metadata?.status).toBe("active");
    expect(metadata?.availability).toBe("mock");
    expect(metadata?.provider).toBe("mock");
  });

  it("reports availability 'live' and the real provider's name once one is configured", () => {
    registerSkill(stubSkill());
    const liveProvider: AIProvider = { name: "live-stub", complete: async () => ({ content: "ok", requiresApproval: true, model: "m", finishReason: "stop" }) };
    registerAIProvider(liveProvider);
    const metadata = getSkillMetadata("stub-skill");
    expect(metadata?.availability).toBe("live");
    expect(metadata?.provider).toBe("live-stub");
  });

  it("uses the linked use case's own promptVersion when registered", () => {
    registerSkill(stubSkill({ version: "skill-v1" }));
    registerAIUseCase({
      useCaseId: "stub-skill",
      promptVersion: "prompt-v9",
      systemInstructions: "system",
      buildMessages: () => [],
      outputSchema: z.unknown(),
      requiredCapabilities: [],
      tokenBudget: { maxInputTokens: 100, reservedOutputTokens: 10 },
      humanApprovalPolicy: "not_required",
    });
    expect(getSkillMetadata("stub-skill")?.promptVersion).toBe("prompt-v9");
  });

  it("falls back to the Skill's own declared version when no use case is registered", () => {
    registerSkill(stubSkill({ version: "skill-v1" }));
    expect(getSkillMetadata("stub-skill")?.promptVersion).toBe("skill-v1");
  });

  it("carries through category, capabilities, requiresApproval, and requiresReview unchanged", () => {
    registerSkill(stubSkill({ category: "finance", requiredCapabilities: ["structured_output"], requiresApproval: true, requiresReview: true }));
    const metadata = getSkillMetadata("stub-skill");
    expect(metadata?.category).toBe("finance");
    expect(metadata?.capabilities).toEqual(["structured_output"]);
    expect(metadata?.requiresApproval).toBe(true);
    expect(metadata?.requiresReview).toBe(true);
  });
});

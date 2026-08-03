import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { registerSkill, unregisterSkill, getSkill, listSkills, listSkillsByCategory, resetSkillRegistry } from "@/core/ai/skills/registry";
import type { SkillDefinition } from "@/core/ai/skills/types";

function stubSkill(overrides: Partial<SkillDefinition> = {}): SkillDefinition {
  return {
    id: "stub-skill",
    name: "Stub Skill",
    description: "A minimal Skill for registry tests.",
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
    ...overrides,
  };
}

describe("Skill Registry", () => {
  afterEach(() => resetSkillRegistry());

  it("registers and retrieves a Skill by id", () => {
    registerSkill(stubSkill());
    expect(getSkill("stub-skill")?.name).toBe("Stub Skill");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getSkill("missing")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerSkill(stubSkill({ version: "v1" }));
    registerSkill(stubSkill({ version: "v2" }));
    expect(listSkills()).toHaveLength(1);
    expect(getSkill("stub-skill")?.version).toBe("v2");
  });

  it("removes a Skill on unregister", () => {
    registerSkill(stubSkill());
    unregisterSkill("stub-skill");
    expect(getSkill("stub-skill")).toBeUndefined();
  });

  it("unregistering an unknown id is a no-op", () => {
    expect(() => unregisterSkill("ghost")).not.toThrow();
  });

  it("lists every registered Skill", () => {
    registerSkill(stubSkill({ id: "a" }));
    registerSkill(stubSkill({ id: "b" }));
    expect(listSkills().map((skill) => skill.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerSkill(stubSkill({ id: "a", category: "operations" }));
    registerSkill(stubSkill({ id: "b", category: "proposal" }));
    registerSkill(stubSkill({ id: "c", category: "operations" }));
    expect(listSkillsByCategory("operations").map((skill) => skill.id).sort()).toEqual(["a", "c"]);
    expect(listSkillsByCategory("finance")).toEqual([]);
  });

  it("resets to empty", () => {
    registerSkill(stubSkill());
    resetSkillRegistry();
    expect(listSkills()).toEqual([]);
  });

  it("a new Skill needs only a SkillDefinition object and one registerSkill() call — no registry-side changes", () => {
    // Proof for Step 13 (Developer Experience): adding a Skill to the
    // platform is exactly this — a declarative object plus one call. No
    // change to registry.ts, resolver.ts, or any Dashboard/Picker component
    // was needed to make it discoverable below.
    registerSkill(stubSkill({ id: "brand-new-skill", name: "Brand New Skill", category: "documents" }));
    expect(getSkill("brand-new-skill")?.name).toBe("Brand New Skill");
    expect(listSkillsByCategory("documents").map((skill) => skill.id)).toContain("brand-new-skill");
  });
});

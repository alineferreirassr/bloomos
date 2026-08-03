import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockDependencyRulesRepository, resetDependencyRulesStore, type CreateDependencyRuleInput } from "@/lib/data/mock/dependencyRulesStore";

const baseInput: CreateDependencyRuleInput = {
  subject_resource_type: "equipment",
  subject_identifier: "Drone",
  requires_resource_type: "worker",
  requires_skill: null,
  requires_certification: "Drone Operator",
  description: "A drone requires a certified drone operator.",
};

beforeEach(() => resetDependencyRulesStore());
afterEach(() => resetDependencyRulesStore());

describe("mockDependencyRulesRepository", () => {
  it("creates a rule", async () => {
    const result = await mockDependencyRulesRepository.createRule("ws_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects a blank description", async () => {
    const result = await mockDependencyRulesRepository.createRule("ws_1", { ...baseInput, description: " " });
    expect(result.success).toBe(false);
  });

  it("rejects a rule with neither a required skill nor certification", async () => {
    const result = await mockDependencyRulesRepository.createRule("ws_1", { ...baseInput, requires_certification: null });
    expect(result.success).toBe(false);
  });

  it("listRulesForWorkspace scopes to the workspace", async () => {
    await mockDependencyRulesRepository.createRule("ws_1", baseInput);
    await mockDependencyRulesRepository.createRule("ws_2", baseInput);
    expect(await mockDependencyRulesRepository.listRulesForWorkspace("ws_1")).toHaveLength(1);
  });
});

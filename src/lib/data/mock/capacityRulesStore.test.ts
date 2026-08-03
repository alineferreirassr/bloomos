import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockCapacityRulesRepository, resetCapacityRulesStore, type CreateCapacityRuleInput } from "@/lib/data/mock/capacityRulesStore";

const baseInput: CreateCapacityRuleInput = {
  scope: "team",
  scope_id: "team_1",
  window: "time_window",
  max_concurrent: 2,
};

beforeEach(() => resetCapacityRulesStore());
afterEach(() => resetCapacityRulesStore());

describe("mockCapacityRulesRepository", () => {
  it("creates a rule", async () => {
    const result = await mockCapacityRulesRepository.createRule("ws_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects max_concurrent below 1", async () => {
    const result = await mockCapacityRulesRepository.createRule("ws_1", { ...baseInput, max_concurrent: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a missing scope_id for a non-workspace scope", async () => {
    const result = await mockCapacityRulesRepository.createRule("ws_1", { ...baseInput, scope_id: null });
    expect(result.success).toBe(false);
  });

  it("allows a null scope_id for workspace scope", async () => {
    const result = await mockCapacityRulesRepository.createRule("ws_1", { ...baseInput, scope: "workspace", scope_id: null });
    expect(result.success).toBe(true);
  });

  it("listRulesForWorkspace scopes to the workspace", async () => {
    await mockCapacityRulesRepository.createRule("ws_1", baseInput);
    await mockCapacityRulesRepository.createRule("ws_2", baseInput);
    expect(await mockCapacityRulesRepository.listRulesForWorkspace("ws_1")).toHaveLength(1);
  });
});

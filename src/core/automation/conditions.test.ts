import { afterEach, describe, expect, it } from "vitest";
import { evaluateConditions } from "@/core/automation/conditions";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { AutomationCondition, AutomationTriggerEvent } from "@/types/automation";

function stubTrigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "invoice.overdue",
    workspaceId: "ws_1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actorMemberId: null,
    facts: {},
    ...overrides,
  };
}

afterEach(() => resetFeatureFlagsStore());

describe("evaluateConditions", () => {
  it("passes with no conditions at all", async () => {
    const result = await evaluateConditions([], { trigger: stubTrigger(), role: null });
    expect(result).toBe(true);
  });

  it("evaluates a numeric field from trigger.facts with gte", async () => {
    const conditions: AutomationCondition[] = [{ field: "daysOverdue", operator: "gte", value: 7 }];
    const passing = await evaluateConditions(conditions, { trigger: stubTrigger({ facts: { daysOverdue: 10 } }), role: null });
    const failing = await evaluateConditions(conditions, { trigger: stubTrigger({ facts: { daysOverdue: 3 } }), role: null });
    expect(passing).toBe(true);
    expect(failing).toBe(false);
  });

  it("resolves `role` from the execution context, never from trigger.facts — a trigger can't forge who's running it", async () => {
    const conditions: AutomationCondition[] = [{ field: "role", operator: "eq", value: "manager" }];
    const matching = await evaluateConditions(conditions, { trigger: stubTrigger({ facts: { role: "owner" } }), role: "manager" });
    const mismatching = await evaluateConditions(conditions, { trigger: stubTrigger(), role: "staff" });
    expect(matching).toBe(true);
    expect(mismatching).toBe(false);
  });

  it("resolves `workspaceId` from the trigger's own top-level field, never from facts", async () => {
    const conditions: AutomationCondition[] = [{ field: "workspaceId", operator: "eq", value: "ws_42" }];
    const result = await evaluateConditions(conditions, { trigger: stubTrigger({ workspaceId: "ws_42" }), role: null });
    expect(result).toBe(true);
  });

  it("supports `in`/`notIn` against an array of allowed values", async () => {
    const inCondition: AutomationCondition[] = [{ field: "contractStatus", operator: "in", value: ["signed", "countersigned"] }];
    const notInCondition: AutomationCondition[] = [{ field: "contractStatus", operator: "notIn", value: ["draft"] }];
    expect(await evaluateConditions(inCondition, { trigger: stubTrigger({ facts: { contractStatus: "signed" } }), role: null })).toBe(true);
    expect(await evaluateConditions(inCondition, { trigger: stubTrigger({ facts: { contractStatus: "draft" } }), role: null })).toBe(false);
    expect(await evaluateConditions(notInCondition, { trigger: stubTrigger({ facts: { contractStatus: "signed" } }), role: null })).toBe(true);
  });

  it("every operator compares consistently: eq/neq/gt/lt/lte", async () => {
    const facts = { proposalValueMinor: 500_00 };
    expect(await evaluateConditions([{ field: "proposalValueMinor", operator: "eq", value: 50000 }], { trigger: stubTrigger({ facts }), role: null })).toBe(true);
    expect(await evaluateConditions([{ field: "proposalValueMinor", operator: "neq", value: 1 }], { trigger: stubTrigger({ facts }), role: null })).toBe(true);
    expect(await evaluateConditions([{ field: "proposalValueMinor", operator: "gt", value: 1 }], { trigger: stubTrigger({ facts }), role: null })).toBe(true);
    expect(await evaluateConditions([{ field: "proposalValueMinor", operator: "lt", value: 1 }], { trigger: stubTrigger({ facts }), role: null })).toBe(false);
    expect(await evaluateConditions([{ field: "proposalValueMinor", operator: "lte", value: 50000 }], { trigger: stubTrigger({ facts }), role: null })).toBe(true);
  });

  it("AND-combines every condition — one failure fails the whole set, never partial credit", async () => {
    const conditions: AutomationCondition[] = [
      { field: "eventType", operator: "eq", value: "wedding" },
      { field: "daysOverdue", operator: "gte", value: 999 },
    ];
    const result = await evaluateConditions(conditions, { trigger: stubTrigger({ facts: { eventType: "wedding", daysOverdue: 1 } }), role: null });
    expect(result).toBe(false);
  });

  describe("featureFlag field", () => {
    it("passes with `eq` when the named flag resolves enabled", async () => {
      await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "some-flag", true);
      const result = await evaluateConditions([{ field: "featureFlag", operator: "eq", value: "some-flag" }], { trigger: stubTrigger({ workspaceId: "ws_1" }), role: null });
      expect(result).toBe(true);
    });

    it("fails with `eq` when the named flag resolves disabled", async () => {
      const result = await evaluateConditions([{ field: "featureFlag", operator: "eq", value: "unset-flag" }], { trigger: stubTrigger({ workspaceId: "ws_1" }), role: null });
      expect(result).toBe(false);
    });

    it("`neq` inverts the check — passes when the flag is disabled", async () => {
      const result = await evaluateConditions([{ field: "featureFlag", operator: "neq", value: "unset-flag" }], { trigger: stubTrigger({ workspaceId: "ws_1" }), role: null });
      expect(result).toBe(true);
    });

    it("an unsupported operator against featureFlag never throws — it just fails closed", async () => {
      const result = await evaluateConditions([{ field: "featureFlag", operator: "gt", value: "some-flag" }], { trigger: stubTrigger(), role: null });
      expect(result).toBe(false);
    });
  });
});

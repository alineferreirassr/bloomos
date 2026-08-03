import { describe, expect, it } from "vitest";
import { resolveApplicableCapacityRule, countConcurrentUsage, checkCapacity, type CapacityUsageEntry } from "@/core/scheduling/capacityEngine";
import type { CapacityRule } from "@/types/scheduling";

function makeRule(overrides: Partial<CapacityRule> = {}): CapacityRule {
  return {
    id: "capacity_rule_1",
    workspace_id: "ws_1",
    scope: "team",
    scope_id: "team_1",
    window: "time_window",
    max_concurrent: 2,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeUsage(overrides: Partial<CapacityUsageEntry> = {}): CapacityUsageEntry {
  return {
    scope: "team",
    scope_id: "team_1",
    starts_at: "2026-08-03T09:00:00.000Z",
    ends_at: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

describe("resolveApplicableCapacityRule", () => {
  it("finds a rule matching scope and scope_id", () => {
    const rules = [makeRule()];
    expect(resolveApplicableCapacityRule(rules, "team", "team_1")?.id).toBe("capacity_rule_1");
  });

  it("returns null when nothing matches", () => {
    expect(resolveApplicableCapacityRule([makeRule()], "team", "team_2")).toBeNull();
  });

  it("matches a workspace-scoped rule via scope_id: null", () => {
    const rules = [makeRule({ scope: "workspace", scope_id: null })];
    expect(resolveApplicableCapacityRule(rules, "workspace", null)?.id).toBe("capacity_rule_1");
  });
});

describe("countConcurrentUsage — time_window", () => {
  it("counts only overlapping usage entries for the matching scope", () => {
    const rule = makeRule();
    const usage = [makeUsage({ starts_at: "2026-08-03T09:30:00.000Z", ends_at: "2026-08-03T10:30:00.000Z" }), makeUsage({ starts_at: "2026-08-03T12:00:00.000Z", ends_at: "2026-08-03T13:00:00.000Z" })];
    expect(countConcurrentUsage(rule, { starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" }, usage)).toBe(1);
  });

  it("ignores usage entries for a different scope_id", () => {
    const rule = makeRule();
    const usage = [makeUsage({ scope_id: "team_2" })];
    expect(countConcurrentUsage(rule, { starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" }, usage)).toBe(0);
  });
});

describe("countConcurrentUsage — day", () => {
  it("counts every usage entry on the same calendar date regardless of exact overlap", () => {
    const rule = makeRule({ window: "day" });
    const usage = [makeUsage({ starts_at: "2026-08-03T18:00:00.000Z", ends_at: "2026-08-03T19:00:00.000Z" })];
    expect(countConcurrentUsage(rule, { starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" }, usage)).toBe(1);
  });

  it("excludes a usage entry on a different calendar date", () => {
    const rule = makeRule({ window: "day" });
    const usage = [makeUsage({ starts_at: "2026-08-04T09:00:00.000Z", ends_at: "2026-08-04T10:00:00.000Z" })];
    expect(countConcurrentUsage(rule, { starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" }, usage)).toBe(0);
  });
});

describe("checkCapacity", () => {
  it("is a vacuous pass when no rule is configured", () => {
    expect(checkCapacity(null, { starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" }, [])).toEqual({ withinCapacity: true, currentUsage: 0, maxConcurrent: null });
  });

  it("stays within capacity when usage is below max_concurrent", () => {
    const rule = makeRule({ max_concurrent: 2 });
    const usage = [makeUsage()];
    const result = checkCapacity(rule, { starts_at: "2026-08-03T09:30:00.000Z", ends_at: "2026-08-03T10:30:00.000Z" }, usage);
    expect(result).toEqual({ withinCapacity: true, currentUsage: 1, maxConcurrent: 2 });
  });

  it("breaches capacity when usage already meets max_concurrent", () => {
    const rule = makeRule({ max_concurrent: 1 });
    const usage = [makeUsage()];
    const result = checkCapacity(rule, { starts_at: "2026-08-03T09:30:00.000Z", ends_at: "2026-08-03T10:30:00.000Z" }, usage);
    expect(result.withinCapacity).toBe(false);
    expect(result.currentUsage).toBe(1);
  });
});

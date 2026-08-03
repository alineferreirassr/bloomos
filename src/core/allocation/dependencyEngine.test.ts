import { describe, expect, it } from "vitest";
import { findApplicableRules, checkDependencies, allDependenciesSatisfied } from "@/core/allocation/dependencyEngine";
import type { DependencyRule } from "@/types/allocation";
import type { Worker } from "@/types/workforce";

const NOW = "2026-08-03T00:00:00.000Z";

function makeRule(overrides: Partial<DependencyRule> = {}): DependencyRule {
  return {
    id: "dependency_rule_1",
    workspace_id: "ws_1",
    subject_resource_type: "equipment",
    subject_identifier: "Drone",
    requires_resource_type: "worker",
    requires_skill: null,
    requires_certification: "Drone Operator",
    description: "A drone requires a certified operator.",
    ...overrides,
  };
}

function makeWorker(overrides: Partial<Pick<Worker, "id" | "skills" | "certifications">> = {}): Pick<Worker, "id" | "skills" | "certifications"> {
  return {
    id: "worker_1",
    skills: [],
    certifications: [],
    ...overrides,
  };
}

describe("findApplicableRules", () => {
  it("matches a rule scoped to a specific subject_identifier", () => {
    const rules = [makeRule()];
    expect(findApplicableRules(rules, "equipment", "Drone")).toHaveLength(1);
    expect(findApplicableRules(rules, "equipment", "Ladder")).toHaveLength(0);
  });

  it("matches a rule with no subject_identifier against every resource of that type", () => {
    const rules = [makeRule({ subject_identifier: null })];
    expect(findApplicableRules(rules, "equipment", "Anything")).toHaveLength(1);
  });

  it("ignores a rule for a different subject_resource_type", () => {
    const rules = [makeRule({ subject_resource_type: "vehicle" })];
    expect(findApplicableRules(rules, "equipment", "Drone")).toHaveLength(0);
  });

  it("ignores a rule whose requires_resource_type isn't worker", () => {
    const rules = [makeRule({ requires_resource_type: "equipment" })];
    expect(findApplicableRules(rules, "equipment", "Drone")).toHaveLength(0);
  });
});

describe("checkDependencies", () => {
  it("is satisfied when a selected worker holds the required certification", () => {
    const worker = makeWorker({ certifications: [{ id: "c1", name: "Drone Operator", issuer: "FAA", issued_date: "2025-01-01", expiration_date: null, verified: true }] });
    const results = checkDependencies({ rules: [makeRule()], subjectResourceType: "equipment", subjectIdentifier: "Drone", selectedWorkers: [worker], now: NOW });
    expect(results).toHaveLength(1);
    expect(results[0].satisfied).toBe(true);
    expect(results[0].satisfiedByResourceId).toBe("worker_1");
  });

  it("is unsatisfied when no selected worker holds the certification", () => {
    const worker = makeWorker({ certifications: [] });
    const results = checkDependencies({ rules: [makeRule()], subjectResourceType: "equipment", subjectIdentifier: "Drone", selectedWorkers: [worker], now: NOW });
    expect(results[0].satisfied).toBe(false);
    expect(results[0].satisfiedByResourceId).toBeNull();
  });

  it("is unsatisfied when the worker's certification is unverified", () => {
    const worker = makeWorker({ certifications: [{ id: "c1", name: "Drone Operator", issuer: "FAA", issued_date: "2025-01-01", expiration_date: null, verified: false }] });
    const results = checkDependencies({ rules: [makeRule()], subjectResourceType: "equipment", subjectIdentifier: "Drone", selectedWorkers: [worker], now: NOW });
    expect(results[0].satisfied).toBe(false);
  });

  it("is unsatisfied when the worker's certification has expired", () => {
    const worker = makeWorker({ certifications: [{ id: "c1", name: "Drone Operator", issuer: "FAA", issued_date: "2025-01-01", expiration_date: "2026-01-01", verified: true }] });
    const results = checkDependencies({ rules: [makeRule()], subjectResourceType: "equipment", subjectIdentifier: "Drone", selectedWorkers: [worker], now: NOW });
    expect(results[0].satisfied).toBe(false);
  });

  it("checks a skill-based rule", () => {
    const rule = makeRule({ requires_skill: "Rigging", requires_certification: null });
    const worker = makeWorker({ skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }] });
    const results = checkDependencies({ rules: [rule], subjectResourceType: "equipment", subjectIdentifier: "Drone", selectedWorkers: [worker], now: NOW });
    expect(results[0].satisfied).toBe(true);
  });
});

describe("allDependenciesSatisfied", () => {
  it("is true for an empty result set (no applicable rules)", () => {
    expect(allDependenciesSatisfied([])).toBe(true);
  });

  it("is false when any result is unsatisfied", () => {
    const results = [
      { rule: makeRule(), satisfied: true, satisfiedByResourceId: "worker_1" },
      { rule: makeRule({ id: "rule_2" }), satisfied: false, satisfiedByResourceId: null },
    ];
    expect(allDependenciesSatisfied(results)).toBe(false);
  });
});

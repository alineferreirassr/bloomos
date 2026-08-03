import { describe, expect, it } from "vitest";
import { validateExecution } from "@/core/fieldOperations/executionValidationEngine";
import type { ExecutionValidationInput } from "@/types/fieldOperations";

function validInput(overrides: Partial<ExecutionValidationInput> = {}): ExecutionValidationInput {
  return { dispatchAccepted: true, packageApproved: true, workerAssigned: true, requiredResourcesPresent: true, operationalPlanExists: true, assignmentActive: true, ...overrides };
}

describe("executionValidationEngine", () => {
  it("passes when every check is satisfied", () => {
    const result = validateExecution(validInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("flags dispatch_not_accepted", () => {
    const result = validateExecution(validInput({ dispatchAccepted: false }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "dispatch_not_accepted")).toBe(true);
  });

  it("flags package_not_approved", () => {
    expect(validateExecution(validInput({ packageApproved: false })).errors.some((e) => e.rule === "package_not_approved")).toBe(true);
  });

  it("flags worker_not_assigned", () => {
    expect(validateExecution(validInput({ workerAssigned: false })).errors.some((e) => e.rule === "worker_not_assigned")).toBe(true);
  });

  it("flags required_resources_missing", () => {
    expect(validateExecution(validInput({ requiredResourcesPresent: false })).errors.some((e) => e.rule === "required_resources_missing")).toBe(true);
  });

  it("flags operational_plan_missing", () => {
    expect(validateExecution(validInput({ operationalPlanExists: false })).errors.some((e) => e.rule === "operational_plan_missing")).toBe(true);
  });

  it("flags assignment_inactive", () => {
    expect(validateExecution(validInput({ assignmentActive: false })).errors.some((e) => e.rule === "assignment_inactive")).toBe(true);
  });

  it("accumulates every failing check at once, never short-circuiting", () => {
    const result = validateExecution({ dispatchAccepted: false, packageApproved: false, workerAssigned: false, requiredResourcesPresent: false, operationalPlanExists: false, assignmentActive: false });
    expect(result.errors).toHaveLength(6);
  });

  it("never produces warnings — every named check is blocking", () => {
    const result = validateExecution(validInput({ workerAssigned: false }));
    expect(result.warnings).toHaveLength(0);
  });
});

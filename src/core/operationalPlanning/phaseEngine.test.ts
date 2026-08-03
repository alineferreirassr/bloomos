import { describe, expect, it } from "vitest";
import { resolvePhaseOrder, validatePhaseOrder } from "@/core/operationalPlanning/phaseEngine";
import type { ExecutionPhase, ExecutionPhaseKind } from "@/types/operationalPlanning";

function makePhase(id: string, kind: ExecutionPhaseKind, order: number): ExecutionPhase {
  return { id, kind, name: kind, order, steps: [] };
}

describe("resolvePhaseOrder", () => {
  it("sorts strictly by each phase's own explicit order field", () => {
    const phases = [makePhase("p3", "cleanup", 3), makePhase("p1", "preparation", 1), makePhase("p2", "setup", 2)];
    expect(resolvePhaseOrder(phases).map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("validatePhaseOrder", () => {
  it("flags no issues for a naturally-ordered plan", () => {
    const phases = [makePhase("p1", "preparation", 0), makePhase("p2", "setup", 1), makePhase("p3", "execution", 2), makePhase("p4", "cleanup", 3)];
    expect(validatePhaseOrder(phases)).toHaveLength(0);
  });

  it("flags a phase placed after one that naturally comes later", () => {
    const phases = [makePhase("p1", "execution", 0), makePhase("p2", "preparation", 1)];
    const issues = validatePhaseOrder(phases);
    expect(issues).toHaveLength(1);
    expect(issues[0].phaseId).toBe("p2");
  });

  it("exempts custom phases from the ordering check entirely", () => {
    const phases = [makePhase("p1", "execution", 0), makePhase("p2", "custom", 1), makePhase("p3", "preparation", 2)];
    const issues = validatePhaseOrder(phases);
    expect(issues.some((i) => i.phaseId === "p2")).toBe(false);
    expect(issues.some((i) => i.phaseId === "p3")).toBe(true);
  });
});

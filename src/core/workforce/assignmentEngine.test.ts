import { describe, expect, it } from "vitest";
import { isAssignmentValid, computeWorkerWorkload, resolveAssignableNodeType } from "@/core/workforce/assignmentEngine";
import type { Assignment } from "@/types/workforce";

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment_1",
    workspace_id: "ws_1",
    worker_id: "worker_1",
    assignable_type: "event",
    assignable_id: "event_1",
    role_note: null,
    status: "active",
    starts_at: "2026-07-30T00:00:00.000Z",
    ends_at: null,
    created_by: "member_1",
    created_at: "2026-07-30T00:00:00.000Z",
    updated_at: "2026-07-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("isAssignmentValid", () => {
  it("allows an active worker", () => {
    expect(isAssignmentValid({ status: "active" }).allowed).toBe(true);
  });

  it("blocks a terminated worker", () => {
    const result = isAssignmentValid({ status: "terminated" });
    expect(result.allowed).toBe(false);
    expect(result.reasons[0]).toMatch(/terminated/);
  });

  it("blocks a worker on leave", () => {
    const result = isAssignmentValid({ status: "on_leave" });
    expect(result.allowed).toBe(false);
  });
});

describe("computeWorkerWorkload", () => {
  it("counts only this worker's active assignments", () => {
    const assignments = [
      makeAssignment({ id: "a1", worker_id: "worker_1", status: "active" }),
      makeAssignment({ id: "a2", worker_id: "worker_1", status: "completed" }),
      makeAssignment({ id: "a3", worker_id: "worker_2", status: "active" }),
    ];
    expect(computeWorkerWorkload("worker_1", assignments)).toBe(1);
  });
});

describe("resolveAssignableNodeType", () => {
  it("maps every real assignable type to its KnowledgeNodeType", () => {
    expect(resolveAssignableNodeType("client")).toBe("client");
    expect(resolveAssignableNodeType("event")).toBe("event");
    expect(resolveAssignableNodeType("asset")).toBe("media_asset");
    expect(resolveAssignableNodeType("vehicle")).toBe("vehicle");
    expect(resolveAssignableNodeType("equipment")).toBe("equipment");
    expect(resolveAssignableNodeType("vendor")).toBe("vendor");
  });

  it("honestly returns null for project and task_placeholder — no real backing entity exists", () => {
    expect(resolveAssignableNodeType("project")).toBeNull();
    expect(resolveAssignableNodeType("task_placeholder")).toBeNull();
  });
});

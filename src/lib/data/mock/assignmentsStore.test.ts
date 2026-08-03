import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockAssignmentsRepository, resetAssignmentsStore, type CreateAssignmentInput } from "@/lib/data/mock/assignmentsStore";

const baseInput: CreateAssignmentInput = { worker_id: "worker_1", assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" };

beforeEach(() => resetAssignmentsStore());
afterEach(() => resetAssignmentsStore());

describe("mockAssignmentsRepository", () => {
  it("creates an assignment defaulting to active status", async () => {
    const result = await mockAssignmentsRepository.createAssignment("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.ends_at).toBeNull();
    }
  });

  it("setAssignmentStatus stamps ends_at for a non-active status", async () => {
    const created = await mockAssignmentsRepository.createAssignment("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const result = await mockAssignmentsRepository.setAssignmentStatus(created.data.id, "ws_1", "completed");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ends_at).not.toBeNull();
  });

  it("fails to change status for an assignment in a different workspace", async () => {
    const created = await mockAssignmentsRepository.createAssignment("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const result = await mockAssignmentsRepository.setAssignmentStatus(created.data.id, "ws_2", "cancelled");
    expect(result.success).toBe(false);
  });

  it("lists assignments scoped to a worker", async () => {
    await mockAssignmentsRepository.createAssignment("ws_1", "member_1", baseInput);
    await mockAssignmentsRepository.createAssignment("ws_1", "member_1", { ...baseInput, worker_id: "worker_2" });
    expect(await mockAssignmentsRepository.listAssignmentsForWorker("worker_1")).toHaveLength(1);
  });
});

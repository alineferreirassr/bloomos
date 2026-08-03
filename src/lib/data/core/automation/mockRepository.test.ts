import { afterEach, describe, expect, it } from "vitest";
import { mockAutomationRepository, resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { RecordAutomationExecutionInput } from "@/types/automation";

function stubInput(overrides: Partial<RecordAutomationExecutionInput> = {}): RecordAutomationExecutionInput {
  return {
    automationId: "automation_1",
    automationName: "Stub Automation",
    automationVersion: "v1",
    trigger: "event.created",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [],
    status: "success",
    durationMs: 5,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.005Z",
    ...overrides,
  };
}

afterEach(() => resetAutomationStore());

describe("mockAutomationRepository", () => {
  it("records an execution, assigning a stable generated id", async () => {
    const result = await mockAutomationRepository.recordExecution("ws_1", stubInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toMatch(/^automation_execution_/);
      expect(result.data.workspaceId).toBe("ws_1");
    }
  });

  it("getRecentExecutions scopes strictly by workspaceId", async () => {
    await mockAutomationRepository.recordExecution("ws_1", stubInput());
    await mockAutomationRepository.recordExecution("ws_2", stubInput());
    const results = await mockAutomationRepository.getRecentExecutions("ws_1", 10);
    expect(results).toHaveLength(1);
    expect(results[0].workspaceId).toBe("ws_1");
  });

  it("getRecentExecutions orders newest first and respects the limit", async () => {
    await mockAutomationRepository.recordExecution("ws_1", stubInput({ startedAt: "2026-01-01T00:00:00.000Z" }));
    await mockAutomationRepository.recordExecution("ws_1", stubInput({ startedAt: "2026-01-03T00:00:00.000Z" }));
    await mockAutomationRepository.recordExecution("ws_1", stubInput({ startedAt: "2026-01-02T00:00:00.000Z" }));
    const results = await mockAutomationRepository.getRecentExecutions("ws_1", 2);
    expect(results).toHaveLength(2);
    expect(results.map((execution) => execution.startedAt)).toEqual(["2026-01-03T00:00:00.000Z", "2026-01-02T00:00:00.000Z"]);
  });

  it("getExecutionById finds a persisted execution, or returns null", async () => {
    const created = await mockAutomationRepository.recordExecution("ws_1", stubInput());
    if (!created.success) throw new Error("setup failed");
    expect(await mockAutomationRepository.getExecutionById(created.data.id)).toMatchObject({ id: created.data.id });
    expect(await mockAutomationRepository.getExecutionById("missing")).toBeNull();
  });

  it("getPendingApprovals returns only executions with approvalStatus 'pending', scoped by workspace", async () => {
    await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "pending", status: "pending_approval" }));
    await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "approved", status: "success" }));
    await mockAutomationRepository.recordExecution("ws_2", stubInput({ approvalStatus: "pending", status: "pending_approval" }));
    const results = await mockAutomationRepository.getPendingApprovals("ws_1");
    expect(results).toHaveLength(1);
    expect(results[0].approvalStatus).toBe("pending");
  });

  describe("approveExecution", () => {
    it("flips approvalStatus to 'approved' and stamps approvedBy/approvedAt on a pending execution", async () => {
      const created = await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "pending", status: "pending_approval" }));
      if (!created.success) throw new Error("setup failed");
      const result = await mockAutomationRepository.approveExecution(created.data.id, "approver_1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.approvalStatus).toBe("approved");
        expect(result.data.approvedBy).toBe("approver_1");
        expect(typeof result.data.approvedAt).toBe("string");
      }
    });

    it("fails for an unknown execution id", async () => {
      const result = await mockAutomationRepository.approveExecution("missing", "approver_1");
      expect(result.success).toBe(false);
    });

    it("fails for an execution that isn't pending — never double-approve", async () => {
      const created = await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "approved", status: "success" }));
      if (!created.success) throw new Error("setup failed");
      const result = await mockAutomationRepository.approveExecution(created.data.id, "approver_1");
      expect(result.success).toBe(false);
    });
  });

  describe("rejectExecution", () => {
    it("flips approvalStatus to 'rejected' and status to the terminal 'rejected' state", async () => {
      const created = await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "pending", status: "pending_approval" }));
      if (!created.success) throw new Error("setup failed");
      const result = await mockAutomationRepository.rejectExecution(created.data.id, "approver_1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.approvalStatus).toBe("rejected");
        expect(result.data.status).toBe("rejected");
        expect(result.data.approvedBy).toBe("approver_1");
      }
    });

    it("fails for an execution that isn't pending", async () => {
      const created = await mockAutomationRepository.recordExecution("ws_1", stubInput({ approvalStatus: "approved", status: "success" }));
      if (!created.success) throw new Error("setup failed");
      const result = await mockAutomationRepository.rejectExecution(created.data.id, "approver_1");
      expect(result.success).toBe(false);
    });
  });

  describe("approval overrides", () => {
    it("returns null when no override has ever been set", async () => {
      expect(await mockAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBeNull();
    });

    it("round-trips a set override", async () => {
      await mockAutomationRepository.setApprovalOverride("ws_1", "automation_1", false);
      expect(await mockAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBe(false);
    });

    it("scopes overrides independently per Workspace and per Automation", async () => {
      await mockAutomationRepository.setApprovalOverride("ws_1", "automation_1", false);
      await mockAutomationRepository.setApprovalOverride("ws_1", "automation_2", true);
      await mockAutomationRepository.setApprovalOverride("ws_2", "automation_1", true);
      expect(await mockAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBe(false);
      expect(await mockAutomationRepository.getApprovalOverride("ws_1", "automation_2")).toBe(true);
      expect(await mockAutomationRepository.getApprovalOverride("ws_2", "automation_1")).toBe(true);
    });
  });

  it("resetAutomationStore clears both executions and approval overrides", async () => {
    await mockAutomationRepository.recordExecution("ws_1", stubInput());
    await mockAutomationRepository.setApprovalOverride("ws_1", "automation_1", false);
    resetAutomationStore();
    expect(await mockAutomationRepository.getRecentExecutions("ws_1", 10)).toEqual([]);
    expect(await mockAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getWorkflowLiveMonitorAction, getWorkflowPerformanceMetricsAction, ignoreWorkflowErrorAction, archiveWorkflowErrorAction } from "@/modules/workflowMonitoring/monitoringCenterActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWorkflowErrorAcknowledgements, getWorkflowErrorAcknowledgement } from "@/lib/data/mock/workflowErrorAcknowledgementsStore";
import { mockAutomationRepository, resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { RecordAutomationExecutionInput } from "@/types/automation";

function executionInput(overrides: Partial<RecordAutomationExecutionInput> = {}): RecordAutomationExecutionInput {
  return {
    automationId: "automation_1",
    automationName: "Test Automation",
    automationVersion: "v1",
    trigger: "client.created",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [],
    status: "failure",
    durationMs: 10,
    startedAt: "2026-08-17T00:00:00.000Z",
    completedAt: "2026-08-17T00:00:00.010Z",
    ...overrides,
  };
}

const activeSessionWithAccess: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const activeSessionWithoutAccess: MemberSessionSnapshot = {
  ...activeSessionWithAccess,
  permissions: [],
};

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
  resetAutomationStore();
  resetWorkflowErrorAcknowledgements();
});

describe("getWorkflowLiveMonitorAction", () => {
  it("requires workspace.manage — the same permission every other Workflow/Automation action already requires", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithoutAccess);
    const result = await getWorkflowLiveMonitorAction();
    expect(result.success).toBe(false);
  });

  it("returns a real, empty-but-well-formed snapshot for a workspace with no executions or workflows yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await getWorkflowLiveMonitorAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.buckets.running).toEqual([]);
      expect(result.data.scheduled).toEqual([]);
    }
  });

  it("denies access entirely for a session that isn't active", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as MemberSessionSnapshot);
    const result = await getWorkflowLiveMonitorAction();
    expect(result.success).toBe(false);
  });
});

describe("getWorkflowPerformanceMetricsAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithoutAccess);
    const result = await getWorkflowPerformanceMetricsAction();
    expect(result.success).toBe(false);
  });
});

describe("ignoreWorkflowErrorAction", () => {
  it("sets the acknowledgement status for a real execution belonging to the caller's own workspace", async () => {
    const execution = await mockAutomationRepository.recordExecution("ws_1", executionInput());
    if (!execution.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await ignoreWorkflowErrorAction(execution.data.id, "action_1");
    expect(result.success).toBe(true);
    expect(getWorkflowErrorAcknowledgement(execution.data.id, "action_1")).toBe("ignored");
  });

  it("requires workspace.manage before mutating an acknowledgement", async () => {
    const execution = await mockAutomationRepository.recordExecution("ws_1", executionInput());
    if (!execution.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithoutAccess);
    const result = await ignoreWorkflowErrorAction(execution.data.id, "action_1");
    expect(result.success).toBe(false);
    expect(getWorkflowErrorAcknowledgement(execution.data.id, "action_1")).toBe("open");
  });

  it("Phase 09B — denies acknowledging an execution that belongs to a different workspace, even for an authorized Owner/Admin", async () => {
    const execution = await mockAutomationRepository.recordExecution("ws_2", executionInput());
    if (!execution.success) throw new Error("setup failed");

    // activeSessionWithAccess is workspace.manage on ws_1; the execution belongs to ws_2.
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await ignoreWorkflowErrorAction(execution.data.id, "action_1");
    expect(result.success).toBe(false);
    expect(getWorkflowErrorAcknowledgement(execution.data.id, "action_1")).toBe("open");
  });

  it("fails safely for a nonexistent execution id rather than acknowledging it anyway", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await ignoreWorkflowErrorAction("does-not-exist", "action_1");
    expect(result.success).toBe(false);
    expect(getWorkflowErrorAcknowledgement("does-not-exist", "action_1")).toBe("open");
  });
});

describe("archiveWorkflowErrorAction", () => {
  it("sets the acknowledgement status for a real execution belonging to the caller's own workspace", async () => {
    const execution = await mockAutomationRepository.recordExecution("ws_1", executionInput());
    if (!execution.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await archiveWorkflowErrorAction(execution.data.id, "action_1");
    expect(result.success).toBe(true);
    expect(getWorkflowErrorAcknowledgement(execution.data.id, "action_1")).toBe("archived");
  });

  it("Phase 09B — denies archiving an execution that belongs to a different workspace", async () => {
    const execution = await mockAutomationRepository.recordExecution("ws_2", executionInput());
    if (!execution.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await archiveWorkflowErrorAction(execution.data.id, "action_1");
    expect(result.success).toBe(false);
    expect(getWorkflowErrorAcknowledgement(execution.data.id, "action_1")).toBe("open");
  });
});

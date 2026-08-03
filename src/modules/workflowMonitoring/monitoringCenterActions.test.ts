import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getWorkflowLiveMonitorAction, getWorkflowPerformanceMetricsAction, ignoreWorkflowErrorAction } from "@/modules/workflowMonitoring/monitoringCenterActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWorkflowErrorAcknowledgements, getWorkflowErrorAcknowledgement } from "@/lib/data/mock/workflowErrorAcknowledgementsStore";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";

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
  it("sets the acknowledgement status for the given execution/action pair", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithAccess);
    const result = await ignoreWorkflowErrorAction("exec_1", "action_1");
    expect(result.success).toBe(true);
    expect(getWorkflowErrorAcknowledgement("exec_1", "action_1")).toBe("ignored");
  });

  it("requires workspace.manage before mutating an acknowledgement", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSessionWithoutAccess);
    const result = await ignoreWorkflowErrorAction("exec_1", "action_1");
    expect(result.success).toBe(false);
    expect(getWorkflowErrorAcknowledgement("exec_1", "action_1")).toBe("open");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { rejectAutomationExecution } from "@/modules/automation/rejectAutomationExecution";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import { resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationDefinition, RecordAutomationExecutionInput } from "@/types/automation";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "role-restricted-automation",
    name: "Role Restricted Automation",
    description: "Requires explicit approval before running.",
    category: "operations",
    version: "v1",
    status: "active",
    trigger: "proposal.rejected",
    conditions: [],
    actionIds: [],
    approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

async function recordPending(overrides: Partial<RecordAutomationExecutionInput> = {}) {
  const result = await getAutomationManager().recordExecution("ws_1", {
    automationId: "role-restricted-automation",
    automationName: "Role Restricted Automation",
    automationVersion: "v1",
    trigger: "proposal.rejected",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "pending",
    approvedBy: null,
    approvedAt: null,
    actionResults: [],
    status: "pending_approval",
    durationMs: 0,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

afterEach(() => {
  vi.clearAllMocks();
  resetAutomationRegistry();
  resetAutomationActionRegistry();
  resetAutomationStore();
});

describe("rejectAutomationExecution", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await rejectAutomationExecution("execution_1");
    expect(result.success).toBe(false);
  });

  it("returns a generic access error for an unknown execution id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await rejectAutomationExecution("missing");
    expect(result.success).toBe(false);
  });

  it("returns an error when the approver's role doesn't meet the policy's minimum", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, membership: { ...activeSession.membership, role: "staff" } });
    registerAutomation(stubAutomation());
    const pending = await recordPending();

    const result = await rejectAutomationExecution(pending.id);
    expect(result.success).toBe(false);
  });

  it("marks the execution rejected — a terminal state — without running any Action", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    const pending = await recordPending();

    const result = await rejectAutomationExecution(pending.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approvalStatus).toBe("rejected");
      expect(result.data.status).toBe("rejected");
      expect(result.data.approvedBy).toBe("user_1");
    }
  });

  it("rejecting the same execution twice fails the second time — it's no longer pending", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    const pending = await recordPending();

    await rejectAutomationExecution(pending.id);
    const second = await rejectAutomationExecution(pending.id);
    expect(second.success).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { approveAutomationExecution } from "@/modules/automation/approveAutomationExecution";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionDefinition, AutomationDefinition, RecordAutomationExecutionInput } from "@/types/automation";

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
    actionIds: ["stub-action"],
    approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function stubAction(overrides: Partial<AutomationActionDefinition> = {}): AutomationActionDefinition {
  return {
    id: "stub-action",
    name: "Stub Action",
    description: "A minimal Action.",
    category: "operations",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    execute: vi.fn().mockResolvedValue({ success: true, message: "done" }),
    ...overrides,
  };
}

async function recordPending(overrides: Partial<RecordAutomationExecutionInput> = {}) {
  const result = await getAutomationManager().recordExecution("ws_1", {
    automationId: "role-restricted-automation",
    automationName: "Role Restricted Automation",
    automationVersion: "v1",
    trigger: "proposal.rejected",
    triggerFacts: { proposalId: "proposal_1" },
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

describe("approveAutomationExecution", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await approveAutomationExecution("execution_1");
    expect(result.success).toBe(false);
  });

  it("returns a generic access error for an unknown execution id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await approveAutomationExecution("missing");
    expect(result.success).toBe(false);
  });

  it("returns a generic access error for an execution belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    registerAutomationAction(stubAction());
    const otherWorkspaceExecution = await getAutomationManager().recordExecution("ws_other", {
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
    });
    if (!otherWorkspaceExecution.success) throw new Error("setup failed");
    const result = await approveAutomationExecution(otherWorkspaceExecution.data.id);
    expect(result.success).toBe(false);
  });

  it("returns an error, and never executes any action, when the approver's role doesn't meet the policy's minimum", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, membership: { ...activeSession.membership, role: "staff" } });
    registerAutomation(stubAutomation());
    const execute = vi.fn();
    registerAutomationAction(stubAction({ execute }));
    const pending = await recordPending();

    const result = await approveAutomationExecution(pending.id);
    expect(result.success).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("re-runs the Automation through the Execution Engine and produces a new, fully-executed history record", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    const execute = vi.fn().mockResolvedValue({ success: true, message: "ok" });
    registerAutomationAction(stubAction({ execute }));
    const pending = await recordPending();

    const result = await approveAutomationExecution(pending.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("success");
      expect(result.data.approvalStatus).toBe("approved");
      expect(result.data.id).not.toBe(pending.id);
    }
    expect(execute).toHaveBeenCalledOnce();
  });

  it("marks the original pending record's own approval bookkeeping as approved, leaving it in history (append-only)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    registerAutomationAction(stubAction());
    const pending = await recordPending();

    await approveAutomationExecution(pending.id);

    const original = await getAutomationManager().getExecutionById(pending.id);
    expect(original?.approvalStatus).toBe("approved");
    expect(original?.approvedBy).toBe("user_1");
  });

  it("passes the original trigger's own facts through to the re-run, unmodified", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    let capturedFacts: unknown;
    registerAutomationAction(
      stubAction({
        execute: vi.fn().mockImplementation(async (params) => {
          capturedFacts = params.facts;
          return { success: true, message: "ok" };
        }),
      }),
    );
    const pending = await recordPending({ triggerFacts: { proposalId: "proposal_42" } });

    await approveAutomationExecution(pending.id);
    expect(capturedFacts).toEqual({ proposalId: "proposal_42" });
  });

  it("returns a generic access error when the execution is no longer pending (already resolved)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation());
    registerAutomationAction(stubAction());
    const pending = await recordPending();
    await getAutomationManager().approveExecution(pending.id, "someone-else");

    const result = await approveAutomationExecution(pending.id);
    expect(result.success).toBe(false);
  });
});

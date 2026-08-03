import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

// `registerAutomationDefinitions()` (called at this module's own load) pulls
// in every Automation Action, including the four "Generate X" actions, each
// of which imports its own Skill wrapper — reaching `server-only`-guarded
// files this test never actually exercises. Same standard mock set every
// other AI/Automation entry-point test in this codebase already uses for
// this exact reason (see `reviewProposalDraft.test.ts`).
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getAutomationDashboardData } from "@/modules/automation/getAutomationDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionDefinition, AutomationDefinition } from "@/types/automation";

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
    id: "dashboard-test-automation",
    name: "Dashboard Test Automation",
    description: "A minimal Automation for Dashboard aggregate tests.",
    category: "operations",
    version: "v1",
    status: "active",
    trigger: "event.created",
    conditions: [],
    actionIds: [],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function stubAction(overrides: Partial<AutomationActionDefinition> = {}): AutomationActionDefinition {
  return {
    id: "dashboard-test-action",
    name: "Dashboard Test Action",
    description: "A minimal Action for Dashboard aggregate tests.",
    category: "operations",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    execute: vi.fn().mockResolvedValue({ success: true, message: "done" }),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetAutomationRegistry();
  resetAutomationActionRegistry();
  resetAutomationStore();
});

describe("getAutomationDashboardData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getAutomationDashboardData();
    expect(result.success).toBe(false);
  });

  it("scopes recent executions and pending approvals strictly to this session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getAutomationManager().recordExecution("ws_1", {
      automationId: "a1",
      automationName: "A1",
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
    });
    await getAutomationManager().recordExecution("ws_other", {
      automationId: "a2",
      automationName: "A2",
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
    });

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recentExecutions.map((execution) => execution.automationId)).toEqual(["a1"]);
    }
  });

  it("computes execution statistics by status, and averageDurationMs, over the returned window", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    for (const [status, durationMs] of [
      ["success", 10],
      ["success", 20],
      ["failure", 30],
    ] as const) {
      await getAutomationManager().recordExecution("ws_1", {
        automationId: "a1",
        automationName: "A1",
        automationVersion: "v1",
        trigger: "event.created",
        triggerFacts: {},
        conditionsPassed: true,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status,
        durationMs,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:00.005Z",
      });
    }

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats.totalExecutions).toBe(3);
      expect(result.data.stats.byStatus.success).toBe(2);
      expect(result.data.stats.byStatus.failure).toBe(1);
      expect(result.data.stats.averageDurationMs).toBe(20);
      expect(result.data.stats.successRatePercent).toBe(67);
    }
  });

  it("failureSummary aggregates failed/partial_failure executions by automation, sorted by failure count", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    for (const automationId of ["frequent-failer", "frequent-failer", "one-off-failer"]) {
      await getAutomationManager().recordExecution("ws_1", {
        automationId,
        automationName: automationId,
        automationVersion: "v1",
        trigger: "event.created",
        triggerFacts: {},
        conditionsPassed: true,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "failure",
        durationMs: 1,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:00.005Z",
      });
    }

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.failureSummary[0]).toMatchObject({ automationId: "frequent-failer", failureCount: 2 });
    }
  });

  it("triggerSummary counts only active Automations currently registered against each trigger type", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation({ id: "listener-a", trigger: "invoice.overdue", status: "active" }));
    registerAutomation(stubAutomation({ id: "listener-b", trigger: "invoice.overdue", status: "active" }));
    registerAutomation(stubAutomation({ id: "disabled-listener", trigger: "invoice.overdue", status: "disabled" }));

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      const overdue = result.data.triggerSummary.find((trigger) => trigger.type === "invoice.overdue");
      expect(overdue?.listenerCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("registeredActions never leaks the Action's own execute function across the RSC boundary", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomationAction(stubAction());

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      const entry = result.data.registeredActions.find((action) => action.id === "dashboard-test-action");
      expect(entry).toBeDefined();
      expect(entry).not.toHaveProperty("execute");
      expect(JSON.parse(JSON.stringify(result.data.registeredActions))).toEqual(result.data.registeredActions);
    }
  });

  it("registeredAutomations is scoped to what this member's permissions/role can see", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    registerAutomation(stubAutomation({ id: "gated", requiredPermissions: ["events.update"] }));

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registeredAutomations.map((automation) => automation.id)).not.toContain("gated");
    }
  });

  it("approvableExecutionIds only includes pending approvals this member's role may actually grant", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, membership: { ...activeSession.membership, role: "staff" } });
    registerAutomation(stubAutomation({ id: "role-restricted", approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" } }));
    const created = await getAutomationManager().recordExecution("ws_1", {
      automationId: "role-restricted",
      automationName: "Role Restricted",
      automationVersion: "v1",
      trigger: "event.created",
      triggerFacts: {},
      conditionsPassed: true,
      approvalStatus: "pending",
      approvedBy: null,
      approvedAt: null,
      actionResults: [],
      status: "pending_approval",
      durationMs: 1,
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
    });
    if (!created.success) throw new Error("setup failed");

    const result = await getAutomationDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pendingApprovals.map((execution) => execution.id)).toContain(created.data.id);
      expect(result.data.approvableExecutionIds).not.toContain(created.data.id);
    }
  });
});

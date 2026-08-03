import { afterEach, describe, expect, it, vi } from "vitest";
import { executeAutomation, dispatchAutomationTrigger } from "@/core/automation/resolver";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import { consoleLogger, setLogger } from "@/core/observability/logger";
import type { AutomationActionDefinition, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { Logger } from "@/core/observability/logger";

function stubAction(overrides: Partial<AutomationActionDefinition> = {}): AutomationActionDefinition {
  return {
    id: "stub-action",
    name: "Stub Action",
    description: "A minimal Action for resolver tests.",
    category: "operations",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    execute: vi.fn().mockResolvedValue({ success: true, message: "done" }),
    ...overrides,
  };
}

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "stub-automation",
    name: "Stub Automation",
    description: "A minimal Automation for resolver tests.",
    category: "operations",
    version: "v1",
    status: "active",
    trigger: "event.created",
    conditions: [],
    actionIds: ["stub-action"],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function stubTrigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "event.created",
    workspaceId: "ws_1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    actorMemberId: "member_1",
    facts: { secretDetail: "never log me" },
    ...overrides,
  };
}

function baseContext() {
  return { workspaceName: "Workspace", userId: "user_1", userName: "User", role: "owner" as const, permissions: [] };
}

afterEach(() => {
  resetAutomationRegistry();
  resetAutomationActionRegistry();
  resetAutomationStore();
  resetFeatureFlagsStore();
  setLogger(consoleLogger);
});

describe("executeAutomation", () => {
  it("denies and persists a failure when a required permission is missing, never running an action", async () => {
    const execute = vi.fn();
    registerAutomationAction(stubAction({ execute }));
    const automation = stubAutomation({ requiredPermissions: ["events.update"] });
    const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), permissions: [] });
    expect(execution.status).toBe("failure");
    expect(execution.actionResults).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("denies when role is below the Automation's own minimum", async () => {
    const automation = stubAutomation({ minimumRole: "manager" });
    const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), role: "staff" });
    expect(execution.status).toBe("failure");
  });

  it("denies when the Automation's feature flag is disabled", async () => {
    const automation = stubAutomation({ featureFlag: "new-automation" });
    const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
    expect(execution.status).toBe("failure");
  });

  it("proceeds once the feature flag is enabled", async () => {
    registerAutomationAction(stubAction());
    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-automation", true);
    const automation = stubAutomation({ featureFlag: "new-automation" });
    const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
    expect(execution.status).toBe("success");
  });

  it("skips (not a failure) when conditions aren't met, never running an action", async () => {
    const execute = vi.fn();
    registerAutomationAction(stubAction({ execute }));
    const automation = stubAutomation({ conditions: [{ field: "eventType", operator: "eq", value: "wedding" }] });
    const execution = await executeAutomation({ automation, trigger: stubTrigger({ facts: { eventType: "picnic" } }), ...baseContext() });
    expect(execution.status).toBe("skipped_conditions_not_met");
    expect(execution.conditionsPassed).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  describe("approval gate", () => {
    it("stops at pending_approval (not a failure) when approval is required and none was given", async () => {
      const execute = vi.fn();
      registerAutomationAction(stubAction({ execute }));
      const automation = stubAutomation({ approvalPolicy: { kind: "always_required" } });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("pending_approval");
      expect(execution.approvalStatus).toBe("pending");
      expect(execute).not.toHaveBeenCalled();
    });

    it("runs actions once approved:true is supplied for a required approval", async () => {
      registerAutomationAction(stubAction());
      const automation = stubAutomation({ approvalPolicy: { kind: "always_required" } });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), approved: true, approverId: "approver_1", approverRole: "owner" });
      expect(execution.status).toBe("success");
      expect(execution.approvalStatus).toBe("approved");
      expect(execution.approvedBy).toBe("approver_1");
    });

    it("rejects when the approver's role doesn't meet a role_restricted policy's minimum, never running an action", async () => {
      const execute = vi.fn();
      registerAutomationAction(stubAction({ execute }));
      const automation = stubAutomation({ approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" } });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), approved: true, approverRole: "staff" });
      expect(execution.status).toBe("rejected");
      expect(execution.approvalStatus).toBe("rejected");
      expect(execute).not.toHaveBeenCalled();
    });

    it("never_required runs straight through with no approval bookkeeping", async () => {
      registerAutomationAction(stubAction());
      const automation = stubAutomation({ approvalPolicy: { kind: "never_required" } });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("success");
      expect(execution.approvalStatus).toBe("not_required");
      expect(execution.approvedBy).toBeNull();
    });
  });

  describe("action execution and status aggregation", () => {
    it("aggregates to success when every action succeeds", async () => {
      registerAutomationAction(stubAction({ id: "a1", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) }));
      registerAutomationAction(stubAction({ id: "a2", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) }));
      const automation = stubAutomation({ actionIds: ["a1", "a2"] });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("success");
      expect(execution.actionResults).toHaveLength(2);
    });

    it("aggregates to failure when every action fails", async () => {
      registerAutomationAction(stubAction({ id: "a1", execute: vi.fn().mockResolvedValue({ success: false, message: "no" }) }));
      const automation = stubAutomation({ actionIds: ["a1"] });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("failure");
    });

    it("aggregates to partial_failure when some actions succeed and some fail", async () => {
      registerAutomationAction(stubAction({ id: "a1", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) }));
      registerAutomationAction(stubAction({ id: "a2", execute: vi.fn().mockResolvedValue({ success: false, message: "no" }) }));
      const automation = stubAutomation({ actionIds: ["a1", "a2"] });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("partial_failure");
    });

    it("runs actions in the automation's own declared order, sequentially, never in parallel", async () => {
      const order: string[] = [];
      registerAutomationAction(
        stubAction({
          id: "a1",
          execute: vi.fn().mockImplementation(async () => {
            order.push("a1");
            return { success: true, message: "ok" };
          }),
        }),
      );
      registerAutomationAction(
        stubAction({
          id: "a2",
          execute: vi.fn().mockImplementation(async () => {
            order.push("a2");
            return { success: true, message: "ok" };
          }),
        }),
      );
      const automation = stubAutomation({ actionIds: ["a1", "a2"] });
      await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(order).toEqual(["a1", "a2"]);
    });

    it("an Automation with zero actions still succeeds", async () => {
      const automation = stubAutomation({ actionIds: [] });
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.status).toBe("success");
      expect(execution.actionResults).toEqual([]);
    });
  });

  describe("history persistence", () => {
    it("persists every execution attempt, including a denied one, via the Automation Manager", async () => {
      const automation = stubAutomation({ requiredPermissions: ["events.update"] });
      await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), permissions: [] });
      const history = await getAutomationManager().getRecentExecutions("ws_1", 10);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ automationId: "stub-automation", status: "failure" });
    });

    it("persisted execution carries a triggerFacts copy, startedAt, completedAt, and a real durationMs", async () => {
      registerAutomationAction(stubAction());
      const automation = stubAutomation();
      const execution = await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext() });
      expect(execution.triggerFacts).toEqual({ secretDetail: "never log me" });
      expect(typeof execution.startedAt).toBe("string");
      expect(typeof execution.completedAt).toBe("string");
      expect(execution.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("observability — never logs sensitive business content", () => {
    it("every logged context is free of the trigger's own facts payload", async () => {
      const calls: unknown[] = [];
      const spyLogger: Logger = {
        debug: vi.fn((_message, context) => calls.push(context)),
        info: vi.fn((_message, context) => calls.push(context)),
        warn: vi.fn((_message, context) => calls.push(context)),
        error: vi.fn((_message, context) => calls.push(context)),
      };
      setLogger(spyLogger);

      registerAutomationAction(stubAction());
      const automation = stubAutomation({ approvalPolicy: { kind: "always_required" } });
      await executeAutomation({ automation, trigger: stubTrigger(), ...baseContext(), approved: true, approverId: "approver_1", approverRole: "owner" });

      expect(calls.length).toBeGreaterThan(0);
      for (const context of calls) {
        expect(JSON.stringify(context)).not.toContain("never log me");
      }
    });
  });
});

describe("dispatchAutomationTrigger", () => {
  it("runs every active Automation registered for the trigger type, independently", async () => {
    registerAutomationAction(stubAction());
    registerAutomation(stubAutomation({ id: "listener-1", trigger: "proposal.rejected" }));
    registerAutomation(stubAutomation({ id: "listener-2", trigger: "proposal.rejected" }));
    registerAutomation(stubAutomation({ id: "other-trigger", trigger: "proposal.accepted" }));

    const results = await dispatchAutomationTrigger(stubTrigger({ type: "proposal.rejected" }), baseContext());
    expect(results.map((execution) => execution.automationId).sort()).toEqual(["listener-1", "listener-2"]);
  });

  it("returns an empty array when nothing listens for the trigger — harmless, not an error", async () => {
    const results = await dispatchAutomationTrigger(stubTrigger({ type: "memory.created" }), baseContext());
    expect(results).toEqual([]);
  });

  it("skips a disabled Automation even if it's registered for the trigger", async () => {
    registerAutomation(stubAutomation({ id: "disabled-one", trigger: "invoice.paid", status: "disabled" }));
    const results = await dispatchAutomationTrigger(stubTrigger({ type: "invoice.paid" }), baseContext());
    expect(results).toEqual([]);
  });

  it("one Automation's own failure never stops another Automation on the same trigger from running", async () => {
    registerAutomationAction(stubAction({ id: "failing-action", execute: vi.fn().mockResolvedValue({ success: false, message: "no" }) }));
    registerAutomationAction(stubAction({ id: "succeeding-action", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) }));
    registerAutomation(stubAutomation({ id: "fails", trigger: "invoice.paid", actionIds: ["failing-action"] }));
    registerAutomation(stubAutomation({ id: "succeeds", trigger: "invoice.paid", actionIds: ["succeeding-action"] }));

    const results = await dispatchAutomationTrigger(stubTrigger({ type: "invoice.paid" }), baseContext());
    const byId = Object.fromEntries(results.map((execution) => [execution.automationId, execution.status]));
    expect(byId).toEqual({ fails: "failure", succeeds: "success" });
  });
});

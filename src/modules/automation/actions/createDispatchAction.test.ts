import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/dispatch", () => ({
  getCoreDispatchBatchesService: vi.fn(),
}));

import createDispatchAction, { CREATE_DISPATCH_ACTION_ID } from "@/modules/automation/actions/createDispatchAction";
import { getCoreDispatchBatchesService } from "@/core/dispatch";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return { type: "client.created", workspaceId: "ws_1", occurredAt: "2026-08-17T00:00:00.000Z", actorMemberId: "user_1", facts: { name: "Move-in Dispatch", orderIds: "order_1,order_2" }, ...overrides };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "workflow-wf_1-trigger-t1-path-0",
    name: "Test Workflow",
    description: "A compiled Workflow for authorization-floor tests.",
    category: "operations",
    version: "workflow-wf_1-v1",
    status: "active",
    trigger: "client.created",
    conditions: [],
    actionIds: [CREATE_DISPATCH_ACTION_ID],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    metadata: { workflowId: "wf_1", workflowVersion: 1, sourceNodeIds: [] },
    workflow: null,
    ...overrides,
  };
}

afterEach(() => {
  resetAutomationActionRegistry();
  resetAutomationStore();
  vi.mocked(getCoreDispatchBatchesService).mockReset();
});

describe("createDispatchAction authorization floor (Phase 09B.1)", () => {
  it("is registered with the same permission its canonical manual path (createDispatchBatchAction) requires", () => {
    expect(createDispatchAction.requiredPermissions).toEqual(["dispatch.manage"]);
  });

  it("A — caller has the action's own authorization floor -> the underlying mutation runs", async () => {
    const createBatch = vi.fn().mockResolvedValue({ success: true, data: { id: "batch_1", name: "Move-in Dispatch" } });
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    const execution = await executeAutomation({
      automation: automation(),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["dispatch.manage"],
    });

    expect(execution.status).toBe("success");
    expect(createBatch).toHaveBeenCalledTimes(1);
  });

  it("B/E — a weak (empty) Workflow executionPolicy cannot substitute for the caller lacking the action's own floor -> DENIED, mutation never runs", async () => {
    const createBatch = vi.fn();
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    // The compiled Automation's own requiredPermissions is [] — the Workflow author added no restriction at all.
    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: [] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_2",
      userName: "Staff Member",
      role: "staff",
      permissions: [], // caller lacks dispatch.manage
    });

    // The Automation-level gate passes (nothing required), so the engine reaches action execution —
    // it's the Action's own independent floor inside runAutomationAction that must deny it here.
    expect(execution.status).toBe("failure");
    expect(execution.actionResults[0]).toMatchObject({ actionId: CREATE_DISPATCH_ACTION_ID, status: "failure" });
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("C — a Workflow that explicitly requires the same permission, with a caller who has it, still succeeds", async () => {
    const createBatch = vi.fn().mockResolvedValue({ success: true, data: { id: "batch_2", name: "Move-in Dispatch" } });
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: ["dispatch.manage"] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["dispatch.manage"],
    });

    expect(execution.status).toBe("success");
    expect(createBatch).toHaveBeenCalledTimes(1);
  });

  it("D — a Workflow that adds an additional restriction on top of the action floor still enforces it", async () => {
    const createBatch = vi.fn();
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    // Workflow author additionally requires "workspace.manage" — caller has the action's own floor
    // (dispatch.manage) but not this extra, Workflow-added restriction.
    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: ["workspace.manage"] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Manager",
      role: "manager",
      permissions: ["dispatch.manage"],
    });

    expect(execution.status).toBe("failure");
    expect(execution.actionResults).toEqual([]); // denied at the Automation-level gate, before the action loop even starts
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("F — denial happens before the business mutation, for the missing-action-floor case specifically", async () => {
    const createBatch = vi.fn();
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    await executeAutomation({
      automation: automation(),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_2",
      userName: "Staff",
      role: "staff",
      permissions: [],
    });

    expect(createBatch).not.toHaveBeenCalled();
  });

  it("G — a successful dispatch is created under the trigger's own workspace, never a caller-suppliable value", async () => {
    const createBatch = vi.fn().mockResolvedValue({ success: true, data: { id: "batch_3", name: "Move-in Dispatch" } });
    vi.mocked(getCoreDispatchBatchesService).mockReturnValue({ createBatch } as never);
    registerAutomationAction(createDispatchAction);

    await executeAutomation({
      automation: automation(),
      trigger: trigger({ workspaceId: "ws_7" }),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["dispatch.manage"],
    });

    expect(createBatch).toHaveBeenCalledWith("ws_7", "user_1", { name: "Move-in Dispatch", order_ids: ["order_1", "order_2"] });
  });
});

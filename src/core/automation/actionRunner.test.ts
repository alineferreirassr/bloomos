import { afterEach, describe, expect, it, vi } from "vitest";
import { runAutomationAction } from "@/core/automation/actionRunner";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { AutomationActionDefinition, AutomationActionParams } from "@/types/automation";

function stubAction(overrides: Partial<AutomationActionDefinition> = {}): AutomationActionDefinition {
  return {
    id: "stub-action",
    name: "Stub Action",
    description: "A minimal Action for actionRunner tests.",
    category: "operations",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    execute: vi.fn().mockResolvedValue({ success: true, message: "done" }),
    ...overrides,
  };
}

function stubParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Workspace",
    userId: "user_1",
    userName: "User",
    role: null,
    permissions: [],
    facts: {},
    automationId: "automation_1",
    ...overrides,
  };
}

afterEach(() => {
  resetAutomationActionRegistry();
  resetFeatureFlagsStore();
});

describe("runAutomationAction", () => {
  it("fails immediately, with 0 attempts, when no Action is registered for the id", async () => {
    const result = await runAutomationAction("ghost", stubParams(), 0);
    expect(result).toMatchObject({ status: "failure", attempts: 0 });
  });

  it("fails without calling execute when a required permission is missing", async () => {
    const execute = vi.fn();
    registerAutomationAction(stubAction({ requiredPermissions: ["events.update"], execute }));
    const result = await runAutomationAction("stub-action", stubParams({ permissions: [] }), 0);
    expect(result.status).toBe("failure");
    expect(execute).not.toHaveBeenCalled();
  });

  it("proceeds once every required permission is present", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, message: "ok" });
    registerAutomationAction(stubAction({ requiredPermissions: ["events.update"], execute }));
    const result = await runAutomationAction("stub-action", stubParams({ permissions: ["events.update"] }), 0);
    expect(result.status).toBe("success");
  });

  it("fails without calling execute when the role is below the Action's own minimum", async () => {
    const execute = vi.fn();
    registerAutomationAction(stubAction({ minimumRole: "manager", execute }));
    const result = await runAutomationAction("stub-action", stubParams({ role: "staff" }), 0);
    expect(result.status).toBe("failure");
    expect(execute).not.toHaveBeenCalled();
  });

  it("proceeds once the role meets the Action's own minimum", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, message: "ok" });
    registerAutomationAction(stubAction({ minimumRole: "manager", execute }));
    const result = await runAutomationAction("stub-action", stubParams({ role: "owner" }), 0);
    expect(result.status).toBe("success");
  });

  it("fails without calling execute when the Action's feature flag is disabled", async () => {
    const execute = vi.fn();
    registerAutomationAction(stubAction({ featureFlag: "new-action", execute }));
    const result = await runAutomationAction("stub-action", stubParams(), 0);
    expect(result.status).toBe("failure");
    expect(execute).not.toHaveBeenCalled();
  });

  it("proceeds once the Action's feature flag is enabled for the Workspace", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, message: "ok" });
    registerAutomationAction(stubAction({ featureFlag: "new-action", execute }));
    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-action", true);
    const result = await runAutomationAction("stub-action", stubParams(), 0);
    expect(result.status).toBe("success");
  });

  it("passes params straight through to the Action's own execute", async () => {
    const execute = vi.fn().mockResolvedValue({ success: true, message: "ok" });
    registerAutomationAction(stubAction({ execute }));
    await runAutomationAction("stub-action", stubParams({ facts: { foo: "bar" } }), 0);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ facts: { foo: "bar" } }));
  });

  it("surfaces a successful result's own resultRef", async () => {
    registerAutomationAction(stubAction({ execute: vi.fn().mockResolvedValue({ success: true, message: "ok", resultRef: { type: "notification", id: "notification_1" } }) }));
    const result = await runAutomationAction("stub-action", stubParams(), 0);
    expect(result.resultRef).toEqual({ type: "notification", id: "notification_1" });
  });

  describe("retry strategy", () => {
    it("does not retry when maxRetries is 0 — one attempt, then a failure", async () => {
      const execute = vi.fn().mockResolvedValue({ success: false, message: "nope" });
      registerAutomationAction(stubAction({ execute }));
      const result = await runAutomationAction("stub-action", stubParams(), 0);
      expect(result).toMatchObject({ status: "failure", attempts: 1, message: "nope" });
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it("retries up to maxRetries additional times on a {success:false} result", async () => {
      const execute = vi.fn().mockResolvedValue({ success: false, message: "still failing" });
      registerAutomationAction(stubAction({ execute }));
      const result = await runAutomationAction("stub-action", stubParams(), 2);
      expect(result).toMatchObject({ status: "failure", attempts: 3 });
      expect(execute).toHaveBeenCalledTimes(3);
    });

    it("retries on a thrown exception, not just a {success:false} result", async () => {
      const execute = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ success: true, message: "recovered" });
      registerAutomationAction(stubAction({ execute }));
      const result = await runAutomationAction("stub-action", stubParams(), 1);
      expect(result).toMatchObject({ status: "success", attempts: 2, message: "recovered" });
    });

    it("stops retrying as soon as an attempt succeeds", async () => {
      const execute = vi.fn().mockResolvedValueOnce({ success: false, message: "first fails" }).mockResolvedValueOnce({ success: true, message: "second succeeds" });
      registerAutomationAction(stubAction({ execute }));
      const result = await runAutomationAction("stub-action", stubParams(), 5);
      expect(result).toMatchObject({ status: "success", attempts: 2 });
      expect(execute).toHaveBeenCalledTimes(2);
    });

    it("a thrown non-Error value still produces a safe, generic failure message", async () => {
      const execute = vi.fn().mockRejectedValue("a raw string throw");
      registerAutomationAction(stubAction({ execute }));
      const result = await runAutomationAction("stub-action", stubParams(), 0);
      expect(result.status).toBe("failure");
      expect(result.message).toBe("Unknown error.");
    });
  });
});

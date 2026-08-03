import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerAutomationAction,
  unregisterAutomationAction,
  getAutomationAction,
  listAutomationActions,
  listAutomationActionsByCategory,
  resetAutomationActionRegistry,
} from "@/core/automation/actionRegistry";
import type { AutomationActionDefinition } from "@/types/automation";

function stubAction(overrides: Partial<AutomationActionDefinition> = {}): AutomationActionDefinition {
  return {
    id: "stub-action",
    name: "Stub Action",
    description: "A minimal Action for registry tests.",
    category: "operations",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    execute: vi.fn().mockResolvedValue({ success: true, message: "done" }),
    ...overrides,
  };
}

describe("Action Registry", () => {
  afterEach(() => resetAutomationActionRegistry());

  it("registers and retrieves an Action by id", () => {
    registerAutomationAction(stubAction());
    expect(getAutomationAction("stub-action")?.name).toBe("Stub Action");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getAutomationAction("missing")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerAutomationAction(stubAction({ version: "v1" }));
    registerAutomationAction(stubAction({ version: "v2" }));
    expect(listAutomationActions()).toHaveLength(1);
    expect(getAutomationAction("stub-action")?.version).toBe("v2");
  });

  it("removes an Action on unregister", () => {
    registerAutomationAction(stubAction());
    unregisterAutomationAction("stub-action");
    expect(getAutomationAction("stub-action")).toBeUndefined();
  });

  it("unregistering an unknown id is a no-op", () => {
    expect(() => unregisterAutomationAction("ghost")).not.toThrow();
  });

  it("lists every registered Action", () => {
    registerAutomationAction(stubAction({ id: "a" }));
    registerAutomationAction(stubAction({ id: "b" }));
    expect(listAutomationActions().map((action) => action.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerAutomationAction(stubAction({ id: "a", category: "operations" }));
    registerAutomationAction(stubAction({ id: "b", category: "finance" }));
    expect(listAutomationActionsByCategory("operations").map((action) => action.id)).toEqual(["a"]);
    expect(listAutomationActionsByCategory("crm")).toEqual([]);
  });

  it("resets to empty", () => {
    registerAutomationAction(stubAction());
    resetAutomationActionRegistry();
    expect(listAutomationActions()).toEqual([]);
  });

  it("Step 6: Actions are the open, registry-based counterpart to Triggers — no hardcoded action list anywhere in the Engine", () => {
    registerAutomationAction(stubAction({ id: "brand-new-action", name: "Brand New Action" }));
    expect(getAutomationAction("brand-new-action")?.name).toBe("Brand New Action");
  });
});

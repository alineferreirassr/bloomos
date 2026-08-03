import { afterEach, describe, expect, it } from "vitest";
import {
  registerAutomation,
  unregisterAutomation,
  getAutomation,
  listAutomations,
  listAutomationsByCategory,
  listAutomationsForTrigger,
  resetAutomationRegistry,
} from "@/core/automation/registry";
import type { AutomationDefinition } from "@/types/automation";

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "stub-automation",
    name: "Stub Automation",
    description: "A minimal Automation Definition for registry tests.",
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

describe("Automation Registry", () => {
  afterEach(() => resetAutomationRegistry());

  it("registers and retrieves an Automation by id", () => {
    registerAutomation(stubAutomation());
    expect(getAutomation("stub-automation")?.name).toBe("Stub Automation");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getAutomation("missing")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerAutomation(stubAutomation({ version: "v1" }));
    registerAutomation(stubAutomation({ version: "v2" }));
    expect(listAutomations()).toHaveLength(1);
    expect(getAutomation("stub-automation")?.version).toBe("v2");
  });

  it("removes an Automation on unregister", () => {
    registerAutomation(stubAutomation());
    unregisterAutomation("stub-automation");
    expect(getAutomation("stub-automation")).toBeUndefined();
  });

  it("unregistering an unknown id is a no-op", () => {
    expect(() => unregisterAutomation("ghost")).not.toThrow();
  });

  it("lists every registered Automation", () => {
    registerAutomation(stubAutomation({ id: "a" }));
    registerAutomation(stubAutomation({ id: "b" }));
    expect(listAutomations().map((automation) => automation.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerAutomation(stubAutomation({ id: "a", category: "operations" }));
    registerAutomation(stubAutomation({ id: "b", category: "finance" }));
    registerAutomation(stubAutomation({ id: "c", category: "operations" }));
    expect(listAutomationsByCategory("operations").map((automation) => automation.id).sort()).toEqual(["a", "c"]);
    expect(listAutomationsByCategory("crm")).toEqual([]);
  });

  describe("listAutomationsForTrigger", () => {
    it("returns only active Automations registered for the given trigger", () => {
      registerAutomation(stubAutomation({ id: "active-match", trigger: "invoice.overdue", status: "active" }));
      registerAutomation(stubAutomation({ id: "disabled-match", trigger: "invoice.overdue", status: "disabled" }));
      registerAutomation(stubAutomation({ id: "other-trigger", trigger: "invoice.paid", status: "active" }));

      const results = listAutomationsForTrigger("invoice.overdue");
      expect(results.map((automation) => automation.id)).toEqual(["active-match"]);
    });

    it("a disabled Automation stays discoverable via listAutomations() but never dispatches", () => {
      registerAutomation(stubAutomation({ id: "disabled-one", trigger: "invoice.overdue", status: "disabled" }));
      expect(listAutomations().map((automation) => automation.id)).toContain("disabled-one");
      expect(listAutomationsForTrigger("invoice.overdue")).toEqual([]);
    });

    it("returns an empty array for a trigger with no registered Automations", () => {
      expect(listAutomationsForTrigger("memory.created")).toEqual([]);
    });
  });

  it("resets to empty", () => {
    registerAutomation(stubAutomation());
    resetAutomationRegistry();
    expect(listAutomations()).toEqual([]);
  });

  it("Step 14 Developer Experience: a new Automation needs only a Trigger, Conditions, Actions, and one registerAutomation() call", () => {
    // Proof mirroring the Skill Registry's own equivalent test — no change
    // to registry.ts, resolver.ts, or the Dashboard was needed to make a
    // brand-new Automation discoverable below.
    registerAutomation(
      stubAutomation({ id: "brand-new-automation", name: "Brand New Automation", trigger: "contract.signed", conditions: [], actionIds: ["create-notification"] }),
    );
    expect(getAutomation("brand-new-automation")?.name).toBe("Brand New Automation");
    expect(listAutomationsForTrigger("contract.signed").map((automation) => automation.id)).toContain("brand-new-automation");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { listAutomationsForWorkspace } from "@/core/automation/discovery";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { AutomationDefinition } from "@/types/automation";

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "stub-automation",
    name: "Stub Automation",
    description: "A minimal Automation for discovery tests.",
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

afterEach(() => {
  resetAutomationRegistry();
  resetFeatureFlagsStore();
});

describe("listAutomationsForWorkspace", () => {
  it("excludes an Automation the member lacks a required permission for", async () => {
    registerAutomation(stubAutomation({ id: "gated", requiredPermissions: ["events.update"] }));
    const results = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results).toEqual([]);
  });

  it("includes an Automation once every required permission is present", async () => {
    registerAutomation(stubAutomation({ id: "gated", requiredPermissions: ["events.update"] }));
    const results = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: ["events.update"], role: "owner" });
    expect(results.map((automation) => automation.id)).toEqual(["gated"]);
  });

  it("excludes an Automation when role is below minimumRole, or unset entirely", async () => {
    registerAutomation(stubAutomation({ id: "role-gated", minimumRole: "manager" }));
    const belowMinimum = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "staff" });
    const noRole = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(belowMinimum).toEqual([]);
    expect(noRole).toEqual([]);
  });

  it("includes an Automation once role meets minimumRole", async () => {
    registerAutomation(stubAutomation({ id: "role-gated", minimumRole: "manager" }));
    const results = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results.map((automation) => automation.id)).toEqual(["role-gated"]);
  });

  it("excludes an Automation whose feature flag is disabled for this Workspace, includes it once enabled", async () => {
    registerAutomation(stubAutomation({ id: "flagged", featureFlag: "new-automation" }));
    const before = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(before).toEqual([]);

    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-automation", true);
    const after = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(after.map((automation) => automation.id)).toEqual(["flagged"]);
  });

  it("sorts results alphabetically by name for a stable Dashboard order", async () => {
    registerAutomation(stubAutomation({ id: "z", name: "Zed Automation" }));
    registerAutomation(stubAutomation({ id: "a", name: "Alpha Automation" }));
    registerAutomation(stubAutomation({ id: "m", name: "Mid Automation" }));
    const results = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results.map((automation) => automation.name)).toEqual(["Alpha Automation", "Mid Automation", "Zed Automation"]);
  });

  it("returns an empty array when nothing is registered", async () => {
    const results = await listAutomationsForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results).toEqual([]);
  });
});

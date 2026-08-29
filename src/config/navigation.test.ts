import { describe, expect, it } from "vitest";
import {
  findActiveNavLabel,
  getNavigableLabelEntries,
  getVisibleNavigationModules,
  groupVisibleNavigationModules,
  navigationModules,
  NAV_GROUP_ORDER,
} from "@/config/navigation";

describe("getVisibleNavigationModules", () => {
  it("shows every module for a member with every permission", () => {
    const visible = getVisibleNavigationModules(() => true);
    expect(visible.map((m) => m.id)).toEqual(navigationModules.map((m) => m.id));
  });

  it("always shows Dashboard, even with no permissions at all", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).toContain("dashboard");
  });

  it("hides Team for a member without team.view", () => {
    const can = (permission: string) => permission !== "team.view";
    const visible = getVisibleNavigationModules(can);
    expect(visible.map((m) => m.id)).not.toContain("team");
  });

  it("hides only Client Accounts/Invitations for a member without clients.portal_view, keeping every other Relationships destination (Leads, Clients, ...) since flattening made each its own permission-gated entry", () => {
    const can = (permission: string) => permission !== "clients.portal_view";
    const visible = getVisibleNavigationModules(can);
    const ids = visible.map((m) => m.id);
    expect(ids).not.toContain("client-accounts");
    expect(ids).not.toContain("client-invitations");
    expect(ids).toContain("leads");
    expect(ids).toContain("clients");
  });

  it("shows Inventory/Vendors/Purchases/Services/Bloom AI regardless of permission — none of their routes has a ROUTE_ACCESS_MAP entry, so canAccessRoute treats them as active-membership-only", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).toEqual(
      expect.arrayContaining(["inventory", "vendors", "purchases", "services", "bloom-ai"]),
    );
  });

  it("hides Settings for a member without workspace.manage, since its reserved href is still permission-gated even while disabled", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).not.toContain("settings");
  });

  it("hides Analytics for a member without analytics.view", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).not.toContain("analytics");
  });

  it("hides Developer for a member without workspace.manage", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).not.toContain("developer");
  });

  it("hides Integrations for a member without workspace.manage", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).not.toContain("integrations");
  });

  it("shows exactly the staff-permitted modules for the seeded staff permission matrix (Settings excluded — staff lacks workspace.manage; Analytics excluded — staff lacks analytics.view; Developer/Marketplace/Integrations excluded — staff lacks workspace.manage)", () => {
    const staffPermissions = new Set([
      "workspace.view",
      "team.view",
      "leads.view",
      "clients.view",
      "events.view",
      "contracts.view",
      "finance.view",
      "documents.view",
      "clients.portal_view",
      "communications.view",
      "notifications.view",
      "notifications.preferences",
      "assets.view",
      "scheduling.view",
      "allocations.view",
      "operational_planning.view",
      "execution_packages.view",
      "dispatch.view",
      "field_operations.view",
      "route_optimization.view",
      "operations_center.view",
      "client_journeys.view",
      "proposal_builder.view",
      "reports.view",
    ]);
    const visible = getVisibleNavigationModules((permission) => staffPermissions.has(permission));
    expect(visible.map((m) => m.id)).toEqual(
      navigationModules.map((m) => m.id).filter((id) => id !== "settings" && id !== "analytics" && id !== "developer" && id !== "marketplace" && id !== "integrations"),
    );
  });
});

describe("groupVisibleNavigationModules", () => {
  it("buckets every visible module into exactly one group, in NAV_GROUP_ORDER, covering every module with no drops or duplicates", () => {
    const groups = groupVisibleNavigationModules(() => true);
    expect(groups.map((g) => g.id)).toEqual(NAV_GROUP_ORDER);
    const flattened = groups.flatMap((g) => g.modules.map((m) => m.id));
    expect(flattened.sort()).toEqual(navigationModules.map((m) => m.id).sort());
  });

  it("drops a group entirely once permission filtering leaves it with zero visible modules", () => {
    // A member who can reach nothing outside the always-visible Workspace/Dashboard.
    const groups = groupVisibleNavigationModules(() => false);
    const groupIds = groups.map((g) => g.id);
    expect(groupIds).toContain("workspace");
    expect(groupIds).not.toContain("insights");
    expect(groupIds).not.toContain("team");
  });

  it("shrinks Insights and System for a staff member without narrowing any other group's membership, and never removes a group a manager with full access would see", () => {
    const staffCan = (permission: string) => permission !== "analytics.view" && permission !== "workspace.manage";
    const staffGroups = groupVisibleNavigationModules(staffCan);
    const insights = staffGroups.find((g) => g.id === "insights");
    const system = staffGroups.find((g) => g.id === "system");
    expect(insights?.modules.map((m) => m.id)).not.toContain("analytics");
    expect(system?.modules.map((m) => m.id)).toEqual(["bloom-ai", "automation"]);

    const managerGroups = groupVisibleNavigationModules(() => true);
    expect(managerGroups.map((g) => g.id)).toEqual(expect.arrayContaining(staffGroups.map((g) => g.id)));
  });
});

describe("getNavigableLabelEntries", () => {
  it("includes every real destination, including the ones formerly hidden inside the CRM/Events expandable groups", () => {
    const entries = getNavigableLabelEntries();
    const hrefs = entries.map((e) => e.href);

    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/leads");
    expect(hrefs).toContain("/pipeline/commercial");
    expect(hrefs).toContain("/client-portal/accounts");
    expect(hrefs).toContain("/client-portal/invitations");
    expect(hrefs).toContain("/bloom-ai");
    expect(hrefs).toContain("/settings");
  });
});

describe("findActiveNavLabel", () => {
  it("resolves a top-level direct link", () => {
    expect(findActiveNavLabel("/dashboard")).toBe("Dashboard");
  });

  it("resolves a formerly-hidden CRM child, now a real top-level entry", () => {
    expect(findActiveNavLabel("/leads")).toBe("Leads");
  });

  it("resolves Bloom AI now that it's a real link, not a disabled placeholder", () => {
    expect(findActiveNavLabel("/bloom-ai")).toBe("Bloom AI");
  });

  it("resolves a sub-page via prefix match", () => {
    expect(findActiveNavLabel("/leads/123")).toBe("Leads");
  });

  it("prefers the longest matching href", () => {
    expect(findActiveNavLabel("/client-portal/accounts")).toBe("Client Accounts");
  });

  it("returns null for a path with no match", () => {
    expect(findActiveNavLabel("/nonexistent")).toBeNull();
  });
});

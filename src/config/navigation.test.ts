import { describe, expect, it } from "vitest";
import {
  findActiveNavLabel,
  getNavigableLabelEntries,
  getVisibleNavigationModules,
  navigationModules,
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

  it("drops the CRM module's Client Accounts/Invitations children for a member without clients.portal_view, but keeps CRM for its other children", () => {
    const can = (permission: string) => permission !== "clients.portal_view";
    const visible = getVisibleNavigationModules(can);
    const crm = visible.find((m) => m.id === "crm");
    expect(crm).toBeDefined();
    expect(crm?.children?.map((c) => c.id)).not.toContain("client-accounts");
    expect(crm?.children?.map((c) => c.id)).not.toContain("client-invitations");
    expect(crm?.children?.map((c) => c.id)).toContain("leads");
  });

  it("drops a module entirely once every one of its children is hidden by permission", () => {
    const can = (permission: string) =>
      !["leads.view", "clients.view", "contracts.view", "clients.portal_view"].includes(permission);
    const visible = getVisibleNavigationModules(can);
    expect(visible.find((m) => m.id === "crm")).toBeUndefined();
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

  it("hides Integrations for a member without workspace.manage", () => {
    const visible = getVisibleNavigationModules(() => false);
    expect(visible.map((m) => m.id)).not.toContain("integrations");
  });
});

describe("getNavigableLabelEntries", () => {
  it("flattens both top-level direct links and every child leaf, excluding disabled and childless-group entries", () => {
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

  it("never includes an entry for CRM or Events themselves, since those are childless-of-href expandable groups", () => {
    const entries = getNavigableLabelEntries();
    expect(entries.find((e) => e.label === "CRM")).toBeUndefined();
    expect(entries.find((e) => e.label === "Events" && e.href === undefined)).toBeUndefined();
  });
});

describe("findActiveNavLabel", () => {
  it("resolves a top-level direct link", () => {
    expect(findActiveNavLabel("/dashboard")).toBe("Dashboard");
  });

  it("resolves a nested child leaf", () => {
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

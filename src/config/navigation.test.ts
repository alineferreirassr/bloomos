import { describe, expect, it } from "vitest";
import { getVisibleNavigationGroups, getVisibleNavigationItems, navigationItems } from "@/config/navigation";

describe("getVisibleNavigationItems", () => {
  it("shows every item for a member with every permission", () => {
    const visible = getVisibleNavigationItems(() => true);
    expect(visible.map((item) => item.href)).toEqual(navigationItems.map((item) => item.href));
  });

  it("always shows Dashboard, even with no permissions at all", () => {
    const visible = getVisibleNavigationItems(() => false);
    expect(visible.map((item) => item.href)).toContain("/dashboard");
  });

  it("hides Team for a member without team.view", () => {
    const can = (permission: string) => permission !== "team.view";
    const visible = getVisibleNavigationItems(can);
    expect(visible.map((item) => item.href)).not.toContain("/team");
  });

  it("hides both Client Portal admin items for a member without clients.portal_view", () => {
    const can = (permission: string) => permission !== "clients.portal_view";
    const visible = getVisibleNavigationItems(can);
    expect(visible.map((item) => item.href)).not.toContain("/client-portal/accounts");
    expect(visible.map((item) => item.href)).not.toContain("/client-portal/invitations");
  });

  it("shows exactly the staff-permitted modules for the seeded staff permission matrix", () => {
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
    ]);
    const visible = getVisibleNavigationItems((permission) => staffPermissions.has(permission));
    expect(visible.map((item) => item.href)).toEqual(navigationItems.map((item) => item.href));
  });
});

describe("getVisibleNavigationGroups", () => {
  it("groups Dashboard ungrouped, and every other item under its own group", () => {
    const groups = getVisibleNavigationGroups(() => true);
    expect(groups.map((g) => g.label)).toEqual([null, "Sales", "Pipeline", "Operations", "Client Portal", "Team"]);
    expect(groups[0].items.map((i) => i.href)).toEqual(["/dashboard"]);
  });

  it("places Accounts and Invitations under a Client Portal group, not under Sales/Clients", () => {
    const groups = getVisibleNavigationGroups(() => true);
    const clientPortalGroup = groups.find((g) => g.label === "Client Portal");
    expect(clientPortalGroup?.items.map((i) => i.label)).toEqual(["Accounts", "Invitations"]);

    const salesGroup = groups.find((g) => g.label === "Sales");
    expect(salesGroup?.items.map((i) => i.label)).toEqual(["Leads", "Clients"]);
  });

  it("drops a group entirely once every one of its items is hidden by permission", () => {
    const can = (permission: string) => permission !== "clients.portal_view";
    const groups = getVisibleNavigationGroups(can);
    expect(groups.find((g) => g.label === "Client Portal")).toBeUndefined();
  });

  it("never renders an empty group header even with no permissions at all", () => {
    const groups = getVisibleNavigationGroups(() => false);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { getVisibleNavigationItems, navigationItems } from "@/config/navigation";

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
    ]);
    const visible = getVisibleNavigationItems((permission) => staffPermissions.has(permission));
    expect(visible.map((item) => item.href)).toEqual(navigationItems.map((item) => item.href));
  });
});

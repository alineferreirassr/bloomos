import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/core/enums/permission";
import { WORKSPACE_MEMBER_ROLES } from "@/core/enums/workspaceRole";
import { getDefaultRolePermissions, roleHasPermission } from "@/lib/team/permissionMatrix";

describe("getDefaultRolePermissions", () => {
  it("grants owner every permission", () => {
    expect(getDefaultRolePermissions("owner")).toHaveLength(PERMISSIONS.length);
  });

  it("grants admin every permission", () => {
    expect(getDefaultRolePermissions("admin")).toHaveLength(PERMISSIONS.length);
  });

  it("grants manager operational access but not team management or finance.refund", () => {
    const manager = getDefaultRolePermissions("manager");
    expect(manager).toContain("leads.create");
    expect(manager).toContain("documents.archive");
    expect(manager).not.toContain("team.invite");
    expect(manager).not.toContain("team.manage_roles");
    expect(manager).not.toContain("finance.refund");
  });

  it("grants staff view-only access plus team.view", () => {
    const staff = getDefaultRolePermissions("staff");
    expect(staff).toContain("leads.view");
    expect(staff).toContain("team.view");
    expect(staff).not.toContain("leads.create");
    expect(staff).not.toContain("team.invite");
  });

  it("has an entry for every canonical role", () => {
    for (const role of WORKSPACE_MEMBER_ROLES) {
      expect(getDefaultRolePermissions(role).length).toBeGreaterThan(0);
    }
  });
});

describe("roleHasPermission", () => {
  it("is true for a granted permission", () => {
    expect(roleHasPermission("owner", "team.manage_roles")).toBe(true);
  });

  it("is false for a permission not granted to that role", () => {
    expect(roleHasPermission("staff", "leads.create")).toBe(false);
  });
});

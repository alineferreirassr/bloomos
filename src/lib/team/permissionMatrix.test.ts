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

  it("v2.0 Checkpoint 31 — grants manager Operations Center view/manage and alert/incident actions, but reserves operations_sensitive_data.view for owner/admin", () => {
    const manager = getDefaultRolePermissions("manager");
    expect(manager).toContain("operations_center.view");
    expect(manager).toContain("operations_center.manage");
    expect(manager).toContain("operations_alerts.acknowledge");
    expect(manager).toContain("operations_alerts.resolve");
    expect(manager).toContain("operations_incidents.manage");
    expect(manager).not.toContain("operations_sensitive_data.view");
  });

  it("v2.0 Checkpoint 31 — grants staff read-only Operations Center access, no alert/incident mutation", () => {
    const staff = getDefaultRolePermissions("staff");
    expect(staff).toContain("operations_center.view");
    expect(staff).not.toContain("operations_alerts.acknowledge");
    expect(staff).not.toContain("operations_incidents.manage");
    expect(staff).not.toContain("operations_sensitive_data.view");
  });

  it("v2.0 Checkpoint 32 — grants manager full Client Journey view/manage/assign/transition and information request management, but reserves client_journey_sensitive_data.view for owner/admin", () => {
    const manager = getDefaultRolePermissions("manager");
    expect(manager).toContain("client_journeys.view");
    expect(manager).toContain("client_journeys.manage");
    expect(manager).toContain("client_journeys.assign");
    expect(manager).toContain("client_journeys.transition");
    expect(manager).toContain("client_information_requests.view");
    expect(manager).toContain("client_information_requests.manage");
    expect(manager).not.toContain("client_journey_sensitive_data.view");
  });

  it("v2.0 Checkpoint 32 — grants staff read-only Client Journey and information request access, no manage/assign/transition", () => {
    const staff = getDefaultRolePermissions("staff");
    expect(staff).toContain("client_journeys.view");
    expect(staff).toContain("client_information_requests.view");
    expect(staff).not.toContain("client_journeys.manage");
    expect(staff).not.toContain("client_journeys.assign");
    expect(staff).not.toContain("client_journeys.transition");
    expect(staff).not.toContain("client_information_requests.manage");
    expect(staff).not.toContain("client_journey_sensitive_data.view");
  });

  it("v2.0 Checkpoint 33 — grants manager full Proposal Platform manage access across templates, builder, versions, pricing, packages, and add-ons", () => {
    const manager = getDefaultRolePermissions("manager");
    expect(manager).toContain("proposal_templates.view");
    expect(manager).toContain("proposal_templates.manage");
    expect(manager).toContain("proposal_builder.view");
    expect(manager).toContain("proposal_builder.manage");
    expect(manager).toContain("proposal_versions.view");
    expect(manager).toContain("proposal_versions.manage");
    expect(manager).toContain("proposal_pricing.manage");
    expect(manager).toContain("proposal_packages.manage");
    expect(manager).toContain("proposal_addons.manage");
  });

  it("v2.0 Checkpoint 33 — grants staff read-only Proposal Platform access, no manage capability anywhere", () => {
    const staff = getDefaultRolePermissions("staff");
    expect(staff).toContain("proposal_templates.view");
    expect(staff).toContain("proposal_builder.view");
    expect(staff).toContain("proposal_versions.view");
    expect(staff).not.toContain("proposal_templates.manage");
    expect(staff).not.toContain("proposal_builder.manage");
    expect(staff).not.toContain("proposal_versions.manage");
    expect(staff).not.toContain("proposal_pricing.manage");
    expect(staff).not.toContain("proposal_packages.manage");
    expect(staff).not.toContain("proposal_addons.manage");
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

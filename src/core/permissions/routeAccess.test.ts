import { describe, expect, it } from "vitest";
import { getRouteAccessRequirement } from "@/core/permissions/routeAccess";
import { resolveMemberAccessDecision } from "@/core/guards/memberAccess";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/team/permissionMatrix";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

describe("getRouteAccessRequirement", () => {
  it("requires only active membership for the dashboard", () => {
    expect(getRouteAccessRequirement("/dashboard")).toEqual({ kind: "active-membership" });
  });

  it("requires only active membership for the account page", () => {
    expect(getRouteAccessRequirement("/account")).toEqual({ kind: "active-membership" });
  });

  it("requires the matching *.view permission for each business module", () => {
    expect(getRouteAccessRequirement("/leads")).toEqual({ kind: "permission", permission: "leads.view" });
    expect(getRouteAccessRequirement("/clients")).toEqual({ kind: "permission", permission: "clients.view" });
    expect(getRouteAccessRequirement("/events")).toEqual({ kind: "permission", permission: "events.view" });
    expect(getRouteAccessRequirement("/contracts")).toEqual({ kind: "permission", permission: "contracts.view" });
    expect(getRouteAccessRequirement("/finance")).toEqual({ kind: "permission", permission: "finance.view" });
    expect(getRouteAccessRequirement("/documents")).toEqual({ kind: "permission", permission: "documents.view" });
  });

  it("requires team.view for the Team page", () => {
    expect(getRouteAccessRequirement("/team")).toEqual({ kind: "permission", permission: "team.view" });
  });

  it("requires events.view for the Operational Pipeline, matching the Events module it visualizes", () => {
    expect(getRouteAccessRequirement("/pipeline/operational")).toEqual({ kind: "permission", permission: "events.view" });
  });

  it("requires finance.view for Vendors and Purchases — Finance F1.5: revisited from F1's provisional events.view, since both pages show real financial amounts (Finance-domain content, not Events-domain content)", () => {
    expect(getRouteAccessRequirement("/vendors")).toEqual({ kind: "permission", permission: "finance.view" });
    expect(getRouteAccessRequirement("/purchases")).toEqual({ kind: "permission", permission: "finance.view" });
    expect(getRouteAccessRequirement("/vendors/vendor_1")).toEqual({ kind: "permission", permission: "finance.view" });
    expect(getRouteAccessRequirement("/purchases/new")).toEqual({ kind: "permission", permission: "finance.view" });
  });

  it("requires clients.portal_view for the Client Portal admin section, including its sub-routes", () => {
    expect(getRouteAccessRequirement("/client-portal")).toEqual({ kind: "permission", permission: "clients.portal_view" });
    expect(getRouteAccessRequirement("/client-portal/accounts")).toEqual({ kind: "permission", permission: "clients.portal_view" });
    expect(getRouteAccessRequirement("/client-portal/invitations")).toEqual({ kind: "permission", permission: "clients.portal_view" });
  });

  it("requires workspace.manage for Workspace Settings", () => {
    expect(getRouteAccessRequirement("/settings")).toEqual({ kind: "permission", permission: "workspace.manage" });
  });

  it("matches nested sub-routes under a module prefix", () => {
    expect(getRouteAccessRequirement("/leads/lead_1/edit")).toEqual({ kind: "permission", permission: "leads.view" });
    expect(getRouteAccessRequirement("/finance/invoices/new")).toEqual({ kind: "permission", permission: "finance.view" });
  });

  it("returns null for an unlisted route", () => {
    expect(getRouteAccessRequirement("/sign-in")).toBeNull();
    expect(getRouteAccessRequirement("/invitations/abc")).toBeNull();
    expect(getRouteAccessRequirement("/")).toBeNull();
  });

  it("never matches a route that merely starts with the same characters as a prefix", () => {
    // "/financewhatever" must not match "/finance"
    expect(getRouteAccessRequirement("/financewhatever")).toBeNull();
  });

  it("Finance F1.5 — grants every current role direct URL access to /vendors and /purchases (all four hold finance.view today, same as they held events.view in F1), and would deny a role that didn't", () => {
    const roles: WorkspaceMemberRole[] = ["owner", "admin", "manager", "staff"];
    for (const role of roles) {
      const requirement = getRouteAccessRequirement("/vendors");
      const decision = resolveMemberAccessDecision({ kind: "active", permissions: [...DEFAULT_ROLE_PERMISSIONS[role]] }, requirement);
      expect(decision).toEqual({ allowed: true });
    }

    // A role holding no permissions at all must be denied — proves the
    // route is genuinely gated now, not just coincidentally open.
    const noPermissions = resolveMemberAccessDecision({ kind: "active", permissions: [] }, getRouteAccessRequirement("/purchases"));
    expect(noPermissions).toEqual({ allowed: false, reason: "forbidden" });
  });
});

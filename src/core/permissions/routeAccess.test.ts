import { describe, expect, it } from "vitest";
import { getRouteAccessRequirement } from "@/core/permissions/routeAccess";

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
});

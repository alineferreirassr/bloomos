import { describe, expect, it } from "vitest";
import { resolveMemberAccessDecision } from "@/core/guards/memberAccess";

describe("resolveMemberAccessDecision", () => {
  it("denies with reason 'unauthenticated' regardless of the route requirement", () => {
    expect(resolveMemberAccessDecision({ kind: "unauthenticated" }, { kind: "active-membership" })).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
    expect(
      resolveMemberAccessDecision({ kind: "unauthenticated" }, { kind: "permission", permission: "team.view" }),
    ).toEqual({ allowed: false, reason: "unauthenticated" });
  });

  it("denies with reason 'no-workspace' regardless of the route requirement", () => {
    expect(resolveMemberAccessDecision({ kind: "no-workspace" }, null)).toEqual({
      allowed: false,
      reason: "no-workspace",
    });
  });

  it("denies with reason 'inactive' even for a route that only requires active membership", () => {
    expect(resolveMemberAccessDecision({ kind: "inactive" }, { kind: "active-membership" })).toEqual({
      allowed: false,
      reason: "inactive",
    });
  });

  it("allows an active member through an active-membership-only route regardless of permissions", () => {
    expect(resolveMemberAccessDecision({ kind: "active", permissions: [] }, { kind: "active-membership" })).toEqual({
      allowed: true,
    });
  });

  it("allows an active member through an unlisted route", () => {
    expect(resolveMemberAccessDecision({ kind: "active", permissions: [] }, null)).toEqual({ allowed: true });
  });

  it("allows an active member who holds the required permission", () => {
    expect(
      resolveMemberAccessDecision(
        { kind: "active", permissions: ["finance.view"] },
        { kind: "permission", permission: "finance.view" },
      ),
    ).toEqual({ allowed: true });
  });

  it("denies with reason 'forbidden' an active member who lacks the required permission", () => {
    expect(
      resolveMemberAccessDecision(
        { kind: "active", permissions: ["leads.view"] },
        { kind: "permission", permission: "finance.view" },
      ),
    ).toEqual({ allowed: false, reason: "forbidden" });
  });
});

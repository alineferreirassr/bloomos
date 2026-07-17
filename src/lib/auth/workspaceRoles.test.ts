import { describe, expect, it } from "vitest";
import { currentUserWorkspaceIds, hasWorkspaceRole, isWorkspaceMember } from "@/lib/auth/workspaceRoles";

const memberships = [
  { workspace_id: "ws_1", user_id: "user_owner", role: "owner" as const, status: "active" as const },
  { workspace_id: "ws_1", user_id: "user_team", role: "staff" as const, status: "active" as const },
  { workspace_id: "ws_1", user_id: "user_suspended", role: "admin" as const, status: "suspended" as const },
  { workspace_id: "ws_1", user_id: "user_invited", role: "staff" as const, status: "invited" as const },
  { workspace_id: "ws_2", user_id: "user_owner", role: "staff" as const, status: "active" as const },
];

describe("isWorkspaceMember", () => {
  it("is true for an active member", () => {
    expect(isWorkspaceMember(memberships, "ws_1", "user_owner")).toBe(true);
  });

  it("is false for a suspended member", () => {
    expect(isWorkspaceMember(memberships, "ws_1", "user_suspended")).toBe(false);
  });

  it("is false for an invited (not yet active) member", () => {
    expect(isWorkspaceMember(memberships, "ws_1", "user_invited")).toBe(false);
  });

  it("is false for a user with no membership row in that workspace", () => {
    expect(isWorkspaceMember(memberships, "ws_1", "user_stranger")).toBe(false);
  });

  it("scopes strictly to the given workspace_id", () => {
    expect(isWorkspaceMember(memberships, "ws_3", "user_owner")).toBe(false);
  });
});

describe("hasWorkspaceRole", () => {
  it("is true when the active member's role is in the allowed list", () => {
    expect(hasWorkspaceRole(memberships, "ws_1", "user_owner", ["owner", "admin"])).toBe(true);
  });

  it("is false when the active member's role is not in the allowed list", () => {
    expect(hasWorkspaceRole(memberships, "ws_1", "user_team", ["owner", "admin"])).toBe(false);
  });

  it("is false for a suspended member even if their role would otherwise qualify", () => {
    expect(hasWorkspaceRole(memberships, "ws_1", "user_suspended", ["owner", "admin"])).toBe(false);
  });

  it("is false for a user with no membership row", () => {
    expect(hasWorkspaceRole(memberships, "ws_1", "user_stranger", ["owner", "admin"])).toBe(false);
  });
});

describe("currentUserWorkspaceIds", () => {
  it("returns every active workspace for the user", () => {
    expect(currentUserWorkspaceIds(memberships, "user_owner").sort()).toEqual(["ws_1", "ws_2"]);
  });

  it("excludes suspended/invited memberships", () => {
    expect(currentUserWorkspaceIds(memberships, "user_suspended")).toEqual([]);
    expect(currentUserWorkspaceIds(memberships, "user_invited")).toEqual([]);
  });

  it("returns an empty array for a user with no memberships", () => {
    expect(currentUserWorkspaceIds(memberships, "user_stranger")).toEqual([]);
  });
});

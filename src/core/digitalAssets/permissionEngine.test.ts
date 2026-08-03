import { describe, expect, it } from "vitest";
import { deriveDefaultVisibility, resolveAssetVisibility, evaluateAssetPermission } from "@/core/digitalAssets/permissionEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";

describe("deriveDefaultVisibility", () => {
  it("derives client visibility for client-owned assets", () => {
    expect(deriveDefaultVisibility({ owner_type: "client" })).toBe("client");
  });

  it("derives team visibility for workspace-owned assets", () => {
    expect(deriveDefaultVisibility({ owner_type: "workspace" })).toBe("team");
  });

  it("derives internal_only for everything else", () => {
    expect(deriveDefaultVisibility({ owner_type: "vendor" })).toBe("internal_only");
  });
});

describe("resolveAssetVisibility", () => {
  it("uses the derived default when there's no override", () => {
    const asset = buildTestAsset({ owner_type: "client" });
    expect(resolveAssetVisibility(asset, {})).toBe("client");
  });

  it("prefers an explicit override over the derived default", () => {
    const asset = buildTestAsset({ owner_type: "client" });
    expect(resolveAssetVisibility(asset, { [asset.id]: "internal_only" })).toBe("internal_only");
  });
});

describe("evaluateAssetPermission", () => {
  it("allows a team member every action when they can manage assets", () => {
    const asset = buildTestAsset();
    const permission = evaluateAssetPermission(asset, "team", { context: "team", canManage: true });
    expect(permission.checks.every((c) => c.allowed)).toBe(true);
  });

  it("blocks edit/delete/share for a team member without manage permission", () => {
    const asset = buildTestAsset();
    const permission = evaluateAssetPermission(asset, "team", { context: "team", canManage: false });
    const edit = permission.checks.find((c) => c.action === "edit");
    const preview = permission.checks.find((c) => c.action === "preview");
    expect(edit?.allowed).toBe(false);
    expect(preview?.allowed).toBe(true);
  });

  it("blocks a client viewer entirely when visibility isn't client-facing", () => {
    const asset = buildTestAsset({ status: "approved" });
    const permission = evaluateAssetPermission(asset, "internal_only", { context: "client", canManage: false });
    expect(permission.checks.every((c) => !c.allowed)).toBe(true);
  });

  it("blocks a client viewer from previewing an unapproved client-visible asset", () => {
    const asset = buildTestAsset({ status: "pending" });
    const permission = evaluateAssetPermission(asset, "client", { context: "client", canManage: false });
    const preview = permission.checks.find((c) => c.action === "preview");
    expect(preview?.allowed).toBe(false);
  });

  it("allows a client viewer to preview/download/comment on an approved, client-visible asset but never edit/delete/share", () => {
    const asset = buildTestAsset({ status: "approved" });
    const permission = evaluateAssetPermission(asset, "client", { context: "client", canManage: false });
    expect(permission.checks.find((c) => c.action === "preview")?.allowed).toBe(true);
    expect(permission.checks.find((c) => c.action === "edit")?.allowed).toBe(false);
    expect(permission.checks.find((c) => c.action === "delete")?.allowed).toBe(false);
  });
});

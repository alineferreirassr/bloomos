import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResourceBundlesRepository, resetResourceBundlesStore, type CreateResourceBundleInput } from "@/lib/data/mock/resourceBundlesStore";

const baseInput: CreateResourceBundleInput = {
  name: "Photography Crew",
  description: null,
  required_resources: [{ resource_type: "worker", quantity: 2, capability_requirement_id: null, notes: null }],
  optional_resources: [],
  min_quantity: 2,
  max_quantity: 4,
};

beforeEach(() => resetResourceBundlesStore());
afterEach(() => resetResourceBundlesStore());

describe("mockResourceBundlesRepository", () => {
  it("creates a bundle as active", async () => {
    const result = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("active");
  });

  it("rejects a blank name", async () => {
    const result = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", { ...baseInput, name: " " });
    expect(result.success).toBe(false);
  });

  it("rejects a negative min_quantity", async () => {
    const result = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", { ...baseInput, min_quantity: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects max_quantity below min_quantity", async () => {
    const result = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", { ...baseInput, min_quantity: 3, max_quantity: 2 });
    expect(result.success).toBe(false);
  });

  it("lists bundles scoped to the workspace, excluding archived by default", async () => {
    const created = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", baseInput);
    await mockResourceBundlesRepository.createBundle("ws_2", "member_1", baseInput);
    if (created.success) await mockResourceBundlesRepository.setBundleStatus(created.data.id, "ws_1", "archived");

    expect(await mockResourceBundlesRepository.listBundlesForWorkspace("ws_1")).toEqual([]);
    expect(await mockResourceBundlesRepository.listBundlesForWorkspace("ws_1", true)).toHaveLength(1);
  });

  it("updateBundle merges fields", async () => {
    const created = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const updated = await mockResourceBundlesRepository.updateBundle(created.data.id, "ws_1", { name: "Updated Crew" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.name).toBe("Updated Crew");
  });

  it("setBundleStatus clears archived_at when reactivated", async () => {
    const created = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    await mockResourceBundlesRepository.setBundleStatus(created.data.id, "ws_1", "archived");
    const reactivated = await mockResourceBundlesRepository.setBundleStatus(created.data.id, "ws_1", "active");
    expect(reactivated.success).toBe(true);
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();
  });

  it("duplicateBundle copies fields with a new id and '(Copy)' name", async () => {
    const created = await mockResourceBundlesRepository.createBundle("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const duplicate = await mockResourceBundlesRepository.duplicateBundle(created.data.id, "ws_1", "member_2");
    expect(duplicate.success).toBe(true);
    if (duplicate.success) {
      expect(duplicate.data.id).not.toBe(created.data.id);
      expect(duplicate.data.name).toBe("Photography Crew (Copy)");
      expect(duplicate.data.required_resources).toEqual(baseInput.required_resources);
    }
  });
});

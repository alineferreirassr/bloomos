import { describe, expect, it, beforeEach } from "vitest";
import { mockTagsRepository, resetTagsStore } from "@/lib/data/core/tags/mockRepository";

const WORKSPACE_A = "ws_a";
const WORKSPACE_B = "ws_b";

beforeEach(() => {
  resetTagsStore();
});

describe("mockTagsRepository", () => {
  it("creates a tag and lists it back for its workspace", async () => {
    const result = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "VIP" });
    expect(result.success).toBe(true);

    const tags = await mockTagsRepository.getTags(WORKSPACE_A);
    expect(tags.map((t) => t.label)).toEqual(["VIP"]);
  });

  it("rejects a blank label", async () => {
    const result = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate label within the same workspace (case-insensitive)", async () => {
    await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "Rush Order" });
    const result = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "rush order" });
    expect(result.success).toBe(false);
  });

  it("allows the same label in a different workspace", async () => {
    await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "VIP" });
    const result = await mockTagsRepository.createTag(WORKSPACE_B, "Aline", { label: "VIP" });
    expect(result.success).toBe(true);
  });

  it("isolates tags by workspace_id", async () => {
    await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "A-only" });
    const tagsInB = await mockTagsRepository.getTags(WORKSPACE_B);
    expect(tagsInB).toEqual([]);
  });

  it("assigns a tag to any EntityType owner and lists it back via getTagsForOwner", async () => {
    const created = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "Allergy" });
    if (!created.success) throw new Error("setup failed");

    await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", created.data.id, "lead", "lead_1");
    const tagsOnLead = await mockTagsRepository.getTagsForOwner(WORKSPACE_A, "lead", "lead_1");
    expect(tagsOnLead.map((t) => t.id)).toEqual([created.data.id]);

    const tagsOnUnrelated = await mockTagsRepository.getTagsForOwner(WORKSPACE_A, "event", "event_1");
    expect(tagsOnUnrelated).toEqual([]);
  });

  it("assigning the same tag to the same owner twice is idempotent", async () => {
    const created = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "Repeat" });
    if (!created.success) throw new Error("setup failed");

    await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", created.data.id, "client", "client_1");
    await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", created.data.id, "client", "client_1");

    const owners = await mockTagsRepository.getOwnersForTag(created.data.id);
    expect(owners).toHaveLength(1);
  });

  it("fails to assign a tag that doesn't exist in this workspace", async () => {
    const result = await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", "tag_missing", "lead", "lead_1");
    expect(result.success).toBe(false);
  });

  it("removes a tag assignment without deleting the tag itself", async () => {
    const created = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "Removable" });
    if (!created.success) throw new Error("setup failed");

    const assigned = await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", created.data.id, "lead", "lead_1");
    if (!assigned.success) throw new Error("setup failed");

    await mockTagsRepository.removeTagAssignment(assigned.data.id);
    expect(await mockTagsRepository.getTagsForOwner(WORKSPACE_A, "lead", "lead_1")).toEqual([]);
    expect(await mockTagsRepository.getTags(WORKSPACE_A)).toHaveLength(1);
  });

  it("deleting a tag also removes every assignment referencing it", async () => {
    const created = await mockTagsRepository.createTag(WORKSPACE_A, "Aline", { label: "Cascade" });
    if (!created.success) throw new Error("setup failed");

    await mockTagsRepository.assignTag(WORKSPACE_A, "Aline", created.data.id, "lead", "lead_1");
    await mockTagsRepository.deleteTag(created.data.id);

    expect(await mockTagsRepository.getOwnersForTag(created.data.id)).toEqual([]);
    expect(await mockTagsRepository.getTags(WORKSPACE_A)).toEqual([]);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { mockInstagramCommentRepository, resetInstagramCommentsStore } from "@/lib/data/instagramComment/mockRepository";
import type { CreateInstagramCommentInput } from "@/lib/data/instagramComment/repository";

function stubInput(overrides: Partial<CreateInstagramCommentInput> = {}): CreateInstagramCommentInput {
  return {
    workspaceId: "ws_1",
    instagramAccountIdentityId: "identity_1",
    externalCommentId: "comment_1",
    externalMediaId: "media_1",
    parentExternalCommentId: null,
    externalAuthorId: "author_1",
    externalAuthorUsername: "a_follower",
    content: "Beautiful wedding!",
    externalCreatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => resetInstagramCommentsStore());

describe("mockInstagramCommentRepository", () => {
  it("creates a comment, assigning a stable generated id and defaulting status to active", async () => {
    const result = await mockInstagramCommentRepository.createComment(stubInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toMatch(/^instagram_comment_/);
    expect(result.data.status).toBe("active");
    expect(result.data.workspace_id).toBe("ws_1");
    expect(result.data.instagram_account_identity_id).toBe("identity_1");
  });

  it("stores the parent comment's external id when present, for a reply", async () => {
    const result = await mockInstagramCommentRepository.createComment(stubInput({ parentExternalCommentId: "parent_comment_1" }));
    expect(result.success && result.data.parent_external_comment_id).toBe("parent_comment_1");
  });

  it("allows a comment with no parent (top-level)", async () => {
    const result = await mockInstagramCommentRepository.createComment(stubInput({ parentExternalCommentId: null }));
    expect(result.success && result.data.parent_external_comment_id).toBeNull();
  });

  it("allows a comment with no external_media_id — some event shapes may omit it", async () => {
    const result = await mockInstagramCommentRepository.createComment(stubInput({ externalMediaId: null }));
    expect(result.success && result.data.external_media_id).toBeNull();
  });

  it("rejects a duplicate external comment id for the same Instagram identity", async () => {
    await mockInstagramCommentRepository.createComment(stubInput());
    const result = await mockInstagramCommentRepository.createComment(stubInput());
    expect(result.success).toBe(false);

    const all = await mockInstagramCommentRepository.listCommentsForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("allows the same external comment id under a different Instagram identity — dedup is scoped per identity", async () => {
    await mockInstagramCommentRepository.createComment(stubInput({ instagramAccountIdentityId: "identity_1" }));
    const result = await mockInstagramCommentRepository.createComment(stubInput({ instagramAccountIdentityId: "identity_2" }));
    expect(result.success).toBe(true);
  });

  it("workspace isolation — listCommentsForWorkspace scopes strictly by workspaceId", async () => {
    await mockInstagramCommentRepository.createComment(stubInput({ workspaceId: "ws_1", externalCommentId: "c1" }));
    await mockInstagramCommentRepository.createComment(stubInput({ workspaceId: "ws_2", externalCommentId: "c2" }));

    const wsOne = await mockInstagramCommentRepository.listCommentsForWorkspace("ws_1");
    expect(wsOne).toHaveLength(1);
    expect(wsOne[0].external_comment_id).toBe("c1");
  });

  it("cross-workspace rejection — a comment created for ws_1 never appears in ws_2's own list, even with the same identity id by coincidence", async () => {
    await mockInstagramCommentRepository.createComment(stubInput({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_shared" }));
    const wsTwo = await mockInstagramCommentRepository.listCommentsForWorkspace("ws_2");
    expect(wsTwo).toHaveLength(0);
  });

  it("external ID lookup — getCommentByExternalId finds the row scoped to the right identity, or returns null", async () => {
    await mockInstagramCommentRepository.createComment(stubInput({ instagramAccountIdentityId: "identity_1", externalCommentId: "c1" }));
    expect(await mockInstagramCommentRepository.getCommentByExternalId("identity_1", "c1")).toMatchObject({ external_comment_id: "c1" });
    expect(await mockInstagramCommentRepository.getCommentByExternalId("identity_1", "missing")).toBeNull();
  });

  it("wrong Instagram identity rejection — a lookup under a different identity than the one the comment actually belongs to returns null", async () => {
    await mockInstagramCommentRepository.createComment(stubInput({ instagramAccountIdentityId: "identity_1", externalCommentId: "c1" }));
    expect(await mockInstagramCommentRepository.getCommentByExternalId("identity_2", "c1")).toBeNull();
  });

  describe("updateCommentStatus", () => {
    it("flips status from active to removed", async () => {
      const created = await mockInstagramCommentRepository.createComment(stubInput());
      if (!created.success) throw new Error("setup failed");
      const result = await mockInstagramCommentRepository.updateCommentStatus(created.data.id, "removed");
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.status).toBe("removed");
    });

    it("fails for an unknown comment id", async () => {
      const result = await mockInstagramCommentRepository.updateCommentStatus("missing", "removed");
      expect(result.success).toBe(false);
    });
  });

  it("resetInstagramCommentsStore clears all comments", async () => {
    await mockInstagramCommentRepository.createComment(stubInput());
    resetInstagramCommentsStore();
    expect(await mockInstagramCommentRepository.listCommentsForWorkspace("ws_1")).toEqual([]);
  });
});

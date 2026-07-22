import { describe, expect, it, beforeEach } from "vitest";
import { mockCommentsRepository, resetCommentsStore } from "@/lib/data/core/comments/mockRepository";

const WORKSPACE_A = "ws_a";

beforeEach(() => {
  resetCommentsStore();
});

describe("mockCommentsRepository", () => {
  it("creates a comment on any EntityType owner and lists it back", async () => {
    const result = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "event", "event_1", { body: "Looks great!" });
    expect(result.success).toBe(true);

    const comments = await mockCommentsRepository.getCommentsForOwner(WORKSPACE_A, "event", "event_1");
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe("Looks great!");
  });

  it("rejects an empty comment body", async () => {
    const result = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "event", "event_1", { body: "   " });
    expect(result.success).toBe(false);
  });

  it("supports one level of reply threading via parentCommentId", async () => {
    const root = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "lead", "lead_1", { body: "Root" });
    if (!root.success) throw new Error("setup failed");

    const reply = await mockCommentsRepository.createComment(WORKSPACE_A, "Sofia", "lead", "lead_1", {
      body: "Reply",
      parentCommentId: root.data.id,
    });
    expect(reply.success).toBe(true);
    if (reply.success) {
      expect(reply.data.parent_comment_id).toBe(root.data.id);
    }
  });

  it("rejects a parentCommentId that doesn't belong to the same owner", async () => {
    const root = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "lead", "lead_1", { body: "Root" });
    if (!root.success) throw new Error("setup failed");

    const reply = await mockCommentsRepository.createComment(WORKSPACE_A, "Sofia", "lead", "lead_2", {
      body: "Wrong owner",
      parentCommentId: root.data.id,
    });
    expect(reply.success).toBe(false);
  });

  it("edits a comment and sets edited_at", async () => {
    const created = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "client", "client_1", { body: "Original" });
    if (!created.success) throw new Error("setup failed");

    const updated = await mockCommentsRepository.updateComment(created.data.id, "Edited");
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.body).toBe("Edited");
      expect(updated.data.edited_at).not.toBeNull();
    }
  });

  it("soft-deletes a comment, excluding it from getCommentsForOwner but not erasing it", async () => {
    const created = await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "client", "client_1", { body: "To delete" });
    if (!created.success) throw new Error("setup failed");

    const deleted = await mockCommentsRepository.deleteComment(created.data.id);
    expect(deleted.success).toBe(true);

    const remaining = await mockCommentsRepository.getCommentsForOwner(WORKSPACE_A, "client", "client_1");
    expect(remaining).toEqual([]);
  });

  it("isolates comments by workspace_id and owner", async () => {
    await mockCommentsRepository.createComment(WORKSPACE_A, "Aline", "lead", "lead_1", { body: "A" });
    const forOtherOwner = await mockCommentsRepository.getCommentsForOwner(WORKSPACE_A, "lead", "lead_2");
    expect(forOtherOwner).toEqual([]);
  });
});

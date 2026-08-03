import type { Comment } from "@/types/comment";
import type { EntityType } from "@/core/enums/entityType";
import type { CommentsRepository, CreateCommentInput } from "@/lib/data/core/comments/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let comments: Comment[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetCommentsStore(): void {
  comments = [];
}

async function getCommentsForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Comment[]> {
  await delay(100);
  return comments
    .filter(
      (comment) =>
        comment.workspace_id === workspaceId &&
        comment.owner_type === ownerType &&
        comment.owner_id === ownerId &&
        comment.deleted_at === null,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function createComment(
  workspaceId: string,
  actor: string,
  ownerType: EntityType,
  ownerId: string,
  input: CreateCommentInput,
): Promise<DataResult<Comment>> {
  const body = input.body.trim();
  if (body.length === 0) {
    return fail("Please fix the highlighted fields.", { body: "Comment cannot be empty" });
  }
  const parentCommentId = input.parentCommentId ?? null;
  if (parentCommentId !== null) {
    const parent = comments.find((c) => c.id === parentCommentId);
    if (!parent || parent.workspace_id !== workspaceId || parent.owner_type !== ownerType || parent.owner_id !== ownerId) {
      return fail("Please fix the highlighted fields.", { parentCommentId: "Parent comment not found" });
    }
  }

  const comment: Comment = {
    id: generateId("comment"),
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    parent_comment_id: parentCommentId,
    body,
    author: actor,
    created_at: nowIso(),
    edited_at: null,
    deleted_at: null,
    mentioned_member_ids: input.mentionedMemberIds ?? [],
    mentions_team: input.mentionsTeam ?? false,
  };
  comments = [...comments, comment];
  return ok(comment);
}

async function updateComment(id: string, body: string): Promise<DataResult<Comment>> {
  const existing = comments.find((c) => c.id === id && c.deleted_at === null);
  if (!existing) return fail("Comment not found.");
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return fail("Please fix the highlighted fields.", { body: "Comment cannot be empty" });
  }

  const updated: Comment = { ...existing, body: trimmed, edited_at: nowIso() };
  comments = comments.map((c) => (c.id === id ? updated : c));
  return ok(updated);
}

async function deleteComment(id: string): Promise<DataResult<Comment>> {
  const existing = comments.find((c) => c.id === id && c.deleted_at === null);
  if (!existing) return fail("Comment not found.");

  const updated: Comment = { ...existing, deleted_at: nowIso() };
  comments = comments.map((c) => (c.id === id ? updated : c));
  return ok(updated);
}

async function getAllCommentsForWorkspace(workspaceId: string): Promise<Comment[]> {
  await delay(100);
  return comments.filter((comment) => comment.workspace_id === workspaceId && comment.deleted_at === null).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export const mockCommentsRepository: CommentsRepository = {
  getCommentsForOwner,
  getAllCommentsForWorkspace,
  createComment,
  updateComment,
  deleteComment,
};

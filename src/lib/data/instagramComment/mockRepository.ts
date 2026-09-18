import type { InstagramComment, InstagramCommentStatus } from "@/types/instagramComment";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import type { CreateInstagramCommentInput, InstagramCommentRepository } from "@/lib/data/instagramComment/repository";

let comments: InstagramComment[] = [];

export function resetInstagramCommentsStore(): void {
  comments = [];
}

const NOT_FOUND_ERROR = "This Instagram comment could not be found.";
const DUPLICATE_ERROR = "This Instagram comment has already been recorded.";

async function createComment(input: CreateInstagramCommentInput): Promise<DataResult<InstagramComment>> {
  const duplicate = comments.find((c) => c.instagram_account_identity_id === input.instagramAccountIdentityId && c.external_comment_id === input.externalCommentId);
  if (duplicate) return fail(DUPLICATE_ERROR);

  const timestamp = nowIso();
  const comment: InstagramComment = {
    id: generateId("instagram_comment"),
    workspace_id: input.workspaceId,
    instagram_account_identity_id: input.instagramAccountIdentityId,
    external_comment_id: input.externalCommentId,
    external_media_id: input.externalMediaId,
    parent_external_comment_id: input.parentExternalCommentId,
    external_author_id: input.externalAuthorId,
    external_author_username: input.externalAuthorUsername,
    content: input.content,
    status: "active",
    external_created_at: input.externalCreatedAt,
    created_at: timestamp,
    updated_at: timestamp,
  };
  comments = [...comments, comment];
  return ok(comment);
}

async function getCommentByExternalId(instagramAccountIdentityId: string, externalCommentId: string): Promise<InstagramComment | null> {
  return comments.find((c) => c.instagram_account_identity_id === instagramAccountIdentityId && c.external_comment_id === externalCommentId) ?? null;
}

async function getCommentById(id: string, workspaceId: string): Promise<InstagramComment | null> {
  return comments.find((c) => c.id === id && c.workspace_id === workspaceId) ?? null;
}

async function listCommentsForWorkspace(workspaceId: string): Promise<InstagramComment[]> {
  return comments.filter((c) => c.workspace_id === workspaceId);
}

async function updateCommentStatus(id: string, status: InstagramCommentStatus): Promise<DataResult<InstagramComment>> {
  const existing = comments.find((c) => c.id === id);
  if (!existing) return fail(NOT_FOUND_ERROR);

  const updated: InstagramComment = { ...existing, status, updated_at: nowIso() };
  comments = comments.map((c) => (c.id === id ? updated : c));
  return ok(updated);
}

export const mockInstagramCommentRepository: InstagramCommentRepository = {
  createComment,
  getCommentByExternalId,
  getCommentById,
  listCommentsForWorkspace,
  updateCommentStatus,
};

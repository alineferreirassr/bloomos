import type { Comment } from "@/types/comment";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";

export interface CreateCommentInput {
  body: string;
  parentCommentId?: string | null;
  /** Checkpoint 24, Step 6 — pre-parsed by the caller (`mentionEngine.parseMentions`), which has the team roster this repository doesn't. */
  mentionedMemberIds?: string[];
  mentionsTeam?: boolean;
}

/** Same repository-pattern shape as Tags — fully greenfield, no prior Comments system to preserve. */
export interface CommentsRepository {
  getCommentsForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Comment[]>;
  /** Checkpoint 24 — every comment across every owner in a Workspace, for the workspace-wide Activity Feed (which has no single owner to scope to). Same "add a workspace-wide variant when a cross-cutting feature needs one" precedent as `listClientPortalActivityForWorkspace`. */
  getAllCommentsForWorkspace(workspaceId: string): Promise<Comment[]>;
  createComment(
    workspaceId: string,
    actor: string,
    ownerType: EntityType,
    ownerId: string,
    input: CreateCommentInput,
  ): Promise<DataResult<Comment>>;
  updateComment(id: string, body: string): Promise<DataResult<Comment>>;
  deleteComment(id: string): Promise<DataResult<Comment>>;
}

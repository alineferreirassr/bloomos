import type { Comment } from "@/types/comment";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";

export interface CreateCommentInput {
  body: string;
  parentCommentId?: string | null;
}

/** Same repository-pattern shape as Tags — fully greenfield, no prior Comments system to preserve. */
export interface CommentsRepository {
  getCommentsForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Comment[]>;
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

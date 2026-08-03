import type { CommentsRepository } from "@/lib/data/core/comments/repository";
import { mockCommentsRepository } from "@/lib/data/core/comments/mockRepository";

export type { Comment } from "@/types/comment";
export type { CommentsRepository, CreateCommentInput } from "@/lib/data/core/comments/repository";

/** Mock-only this phase — same rationale as `core/tags`. */
export function getCoreCommentsService(): CommentsRepository {
  return mockCommentsRepository;
}

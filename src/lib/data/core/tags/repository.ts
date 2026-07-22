import type { Tag, TagAssignment } from "@/types/tag";
import type { EntityType } from "@/core/enums/entityType";
import type { DataResult } from "@/lib/data/result";

export interface CreateTagInput {
  label: string;
  color?: string | null;
}

/**
 * The single Tags persistence contract — same repository pattern as every
 * business module (interface here, `mockRepository.ts`/`supabaseRepository.ts`
 * implement it, `lib/data/provider.ts`'s `selectRepository()` picks between
 * them). Fully greenfield: no prior Tags system exists to preserve
 * compatibility with (see `Client.tags: string[]`'s doc comment for the one
 * unrelated free-text precedent this does NOT replace).
 */
export interface TagsRepository {
  getTags(workspaceId: string): Promise<Tag[]>;
  createTag(workspaceId: string, actor: string, input: CreateTagInput): Promise<DataResult<Tag>>;
  deleteTag(id: string): Promise<DataResult<Tag>>;
  getTagsForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<Tag[]>;
  assignTag(workspaceId: string, actor: string, tagId: string, ownerType: EntityType, ownerId: string): Promise<DataResult<TagAssignment>>;
  removeTagAssignment(id: string): Promise<DataResult<TagAssignment>>;
  getOwnersForTag(tagId: string): Promise<TagAssignment[]>;
}

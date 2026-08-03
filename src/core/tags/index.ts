import type { TagsRepository } from "@/lib/data/core/tags/repository";
import { mockTagsRepository } from "@/lib/data/core/tags/mockRepository";

export type { Tag, TagAssignment } from "@/types/tag";
export type { TagsRepository, CreateTagInput } from "@/lib/data/core/tags/repository";

/**
 * Mock-only this phase — Tags is fully greenfield (no prior system, no
 * Supabase table yet; see `docs/database.md` for the "no migration unless
 * truly required" call this foundation phase made). A Supabase
 * implementation slots in behind `lib/data/provider.ts`'s
 * `selectRepository()` exactly like every business module once a consuming
 * feature actually needs Tags persisted past a page reload.
 */
export function getCoreTagsService(): TagsRepository {
  return mockTagsRepository;
}

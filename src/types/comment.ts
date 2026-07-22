import type { EntityType } from "@/core/enums/entityType";

/**
 * A short-form remark on any entity — distinct from `Note` (structured,
 * categorized, prioritized, pinnable, meant to persist as reference
 * material) the same way a chat reply is distinct from a document: a
 * Comment is a lightweight, threaded conversation entry. `parent_comment_id`
 * supports one level of reply threading; deeper nesting is left for a real
 * UI to decide it needs, not assumed here.
 *
 * Soft-deleted (`deleted_at`) rather than removed, so a reply thread never
 * loses its parent silently — the same choice `Document` already makes for
 * its own soft-delete.
 */
export interface Comment {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  parent_comment_id: string | null;
  body: string;
  author: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

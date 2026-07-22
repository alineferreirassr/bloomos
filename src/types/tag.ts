import type { EntityType } from "@/core/enums/entityType";

/**
 * A workspace-level label (e.g. "VIP", "Rush Order") — created once, then
 * applied to any number of entities via `TagAssignment`. Distinct from
 * `Client.tags: string[]` (a free-text, client-only field predating this
 * Core concept, left as-is — see `core/README.md`'s Tags section for why
 * reconciling it is a deliberate follow-up, not part of this phase).
 */
export interface Tag {
  id: string;
  workspace_id: string;
  label: string;
  color: string | null;
  created_by: string;
  created_at: string;
}

/**
 * One entity wearing one Tag — the join itself, not the Tag. Polymorphic
 * `owner_type`/`owner_id` reuses the same `EntityType` union as Notes,
 * Timeline, and MediaAsset, so any current or future entity is taggable
 * without a Tags-specific owner-type concept.
 */
export interface TagAssignment {
  id: string;
  workspace_id: string;
  tag_id: string;
  owner_type: EntityType;
  owner_id: string;
  created_by: string;
  created_at: string;
}

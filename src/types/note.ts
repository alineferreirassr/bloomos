import type { NoteCategory } from "@/core/enums/noteCategory";
import type { NotePriority } from "@/core/enums/notePriority";
import type { EntityType } from "@/core/enums/entityType";

/** Metadata placeholder only — no real file storage exists until Supabase Storage is connected. */
export interface NoteAttachment {
  id: string;
  file_name: string;
  file_type: string;
  size_bytes: number;
}

/**
 * A Note can belong to a Lead or a Client (`owner_type` + `owner_id`) — one
 * shared shape rather than a separate LeadNote/ClientNote type, so the
 * architecture doesn't duplicate itself as more owner types are added.
 *
 * A polymorphic owner means `owner_id` can't carry a normal foreign-key
 * constraint (it points at `leads.id` for one row and `clients.id` for the
 * next) — see docs/database.md's `notes` section for how ownership and
 * workspace consistency get enforced instead (data-layer validation now,
 * Supabase RLS once connected). Every query MUST filter by `workspace_id`
 * together with `owner_type`/`owner_id`, never `owner_id` alone.
 */
export interface Note {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  title: string;
  content: string;
  category: NoteCategory;
  priority: NotePriority;
  is_pinned: boolean;
  attachments: NoteAttachment[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

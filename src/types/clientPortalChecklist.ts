import type { ChecklistStatus } from "@/core/enums/checklistStatus";

/**
 * Checkpoint 14, Step 7 — the client-safe projection of an internal
 * `ChecklistItem` (`types/checklistItem.ts`), returned only for a row
 * whose own `client_visible` is `true`. Deliberately excludes
 * `assigned_type`/`assigned_id`/`assigned_name` (internal staffing),
 * `category`/`priority` (internal triage fields), and
 * `source_event_service_id`/`template_snapshot` (internal Service
 * provenance) — the same "individually reviewed field list" discipline
 * `types/clientPortal.ts`'s own header comment already establishes for
 * every other Client Portal projection.
 */
export interface ClientPortalChecklistItem {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  status: ChecklistStatus;
  due_date: string | null;
  completed_at: string | null;
  /** The client's own most recent comment on this item, if any — plain text, never HTML. */
  client_comment: string | null;
}

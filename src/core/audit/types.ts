import type { EntityType } from "@/core/enums/entityType";

/**
 * A field-level, before/after change record — distinct from `TimelineActivity`
 * (a user-facing "what happened" feed entry, e.g. "Note added"). AuditLogEntry
 * exists for compliance/traceability: exactly which fields changed and what
 * they were before, not a human-readable description of the event. The two
 * concepts often get created together (an audited change usually also gets a
 * Timeline entry a user would want to see), but AuditLogEntry never replaces
 * Timeline and vice versa — see `src/audit/README.md`'s prior note that this
 * was deliberately deferred until a module actually needed it.
 *
 * `before`/`after` are `null` for actions with no field-level diff (e.g. a
 * delete has an `after` of `null`, a create has a `before` of `null`).
 */
export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor: string;
  action: string;
  owner_type: EntityType;
  owner_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  occurred_at: string;
}

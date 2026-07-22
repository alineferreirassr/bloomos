import type { AuditLogEntry } from "@/core/audit/types";
import type { EntityType } from "@/core/enums/entityType";

export interface RecordAuditEventInput {
  actor: string;
  action: string;
  ownerType: EntityType;
  ownerId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/**
 * Deliberately append-only: no `update`/`delete` method exists on this
 * interface at all, so "immutable" is enforced at the type level, not just
 * by convention — an audit trail that can be edited or removed isn't one.
 * `recordAuditEvent` doesn't return a `DataResult` (no validation can fail
 * short of a malformed call) — it either succeeds or throws, matching how
 * `recordTimelineActivity` behaves today.
 */
export interface AuditLogRepository {
  recordAuditEvent(workspaceId: string, input: RecordAuditEventInput): Promise<AuditLogEntry>;
  getAuditLogForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<AuditLogEntry[]>;
  getAuditLogForWorkspace(workspaceId: string): Promise<AuditLogEntry[]>;
}

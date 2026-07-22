import type { AuditLogRepository } from "@/lib/data/core/audit/repository";
import { mockAuditLogRepository } from "@/lib/data/core/audit/mockRepository";

export type { AuditLogEntry } from "@/core/audit/types";
export type { AuditLogRepository, RecordAuditEventInput } from "@/lib/data/core/audit/repository";

/** Mock-only this phase — same rationale as `core/tags`. */
export function getCoreAuditLogService(): AuditLogRepository {
  return mockAuditLogRepository;
}

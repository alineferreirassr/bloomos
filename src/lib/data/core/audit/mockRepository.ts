import type { AuditLogEntry } from "@/core/audit/types";
import type { EntityType } from "@/core/enums/entityType";
import type { AuditLogRepository, RecordAuditEventInput } from "@/lib/data/core/audit/repository";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let entries: AuditLogEntry[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetAuditLogStore(): void {
  entries = [];
}

async function recordAuditEvent(workspaceId: string, input: RecordAuditEventInput): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: generateId("audit"),
    workspace_id: workspaceId,
    actor: input.actor,
    action: input.action,
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    before: input.before ?? null,
    after: input.after ?? null,
    occurred_at: nowIso(),
  };
  entries = [...entries, entry];
  return entry;
}

async function getAuditLogForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<AuditLogEntry[]> {
  await delay(100);
  return entries
    .filter((e) => e.workspace_id === workspaceId && e.owner_type === ownerType && e.owner_id === ownerId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

async function getAuditLogForWorkspace(workspaceId: string): Promise<AuditLogEntry[]> {
  await delay(100);
  return entries.filter((e) => e.workspace_id === workspaceId).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export const mockAuditLogRepository: AuditLogRepository = {
  recordAuditEvent,
  getAuditLogForOwner,
  getAuditLogForWorkspace,
};

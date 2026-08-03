import { getCoreAuditLogService } from "@/core/audit";
import type { AuditLogEntry } from "@/core/audit";

/**
 * The Audit Center (v2 Checkpoint 22, Step 12) — never a second audit
 * store. It wraps `getCoreAuditLogService()` (Checkpoint-agnostic, mock-
 * only, already the single append-only audit trail every other domain
 * writes to) with two typed helpers scoped to the two new `EntityType`s
 * this checkpoint adds (`integration_connection`, `integration_credential`
 * — `core/enums/entityType.ts`), so a caller never has to remember the
 * right `ownerType` string by hand.
 */

export async function recordConnectionAuditEvent(
  workspaceId: string,
  actor: string,
  action: string,
  connectionId: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
): Promise<AuditLogEntry> {
  return getCoreAuditLogService().recordAuditEvent(workspaceId, { actor, action, ownerType: "integration_connection", ownerId: connectionId, before, after });
}

export async function recordCredentialAuditEvent(
  workspaceId: string,
  actor: string,
  action: string,
  credentialId: string,
  before: Record<string, unknown> | null = null,
  after: Record<string, unknown> | null = null,
): Promise<AuditLogEntry> {
  return getCoreAuditLogService().recordAuditEvent(workspaceId, { actor, action, ownerType: "integration_credential", ownerId: credentialId, before, after });
}

export async function getAuditLogForConnection(workspaceId: string, connectionId: string): Promise<AuditLogEntry[]> {
  return getCoreAuditLogService().getAuditLogForOwner(workspaceId, "integration_connection", connectionId);
}

export async function getAuditLogForCredential(workspaceId: string, credentialId: string): Promise<AuditLogEntry[]> {
  return getCoreAuditLogService().getAuditLogForOwner(workspaceId, "integration_credential", credentialId);
}

/** Every Integration Platform audit entry for the workspace — connections and credentials together, newest first — the read a Developer Center diagnostics tab (Step 15) would show. */
export async function getIntegrationAuditLog(workspaceId: string): Promise<AuditLogEntry[]> {
  const entries = await getCoreAuditLogService().getAuditLogForWorkspace(workspaceId);
  return entries
    .filter((entry) => entry.owner_type === "integration_connection" || entry.owner_type === "integration_credential")
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

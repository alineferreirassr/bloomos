import { generateId } from "@/lib/data/utils";
import type { IntegrationErrorRecord } from "@/core/integrations/types";

/** v2 Checkpoint 43. Mock-only, same precedent as `credentialStore.ts`. Every record here is already sanitized by `errorSanitizer.ts` before it's inserted — never a raw caught exception. */
let errorRecords: IntegrationErrorRecord[] = [];

export function resetErrorRecordStore(): void {
  errorRecords = [];
}

export function insertErrorRecord(record: IntegrationErrorRecord): IntegrationErrorRecord {
  errorRecords = [...errorRecords, record];
  return record;
}

export function listErrorRecordsForConnection(connectionId: string): IntegrationErrorRecord[] {
  return errorRecords.filter((record) => record.connection_id === connectionId).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

export function countRecentErrorsForConnection(connectionId: string, sinceIso: string): number {
  return errorRecords.filter((record) => record.connection_id === connectionId && record.occurred_at >= sinceIso).length;
}

export function generateErrorRecordId(): string {
  return generateId("integration-error");
}

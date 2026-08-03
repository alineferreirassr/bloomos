import { mockFieldOperationsRepository } from "@/lib/data/mock/fieldOperationsStore";

export type { FieldOperation, FieldOperationStatus } from "@/types/fieldOperations";
export type { ExecutionSession, ExecutionAttempt, ExecutionLifecycleState, ExecutionOutcome } from "@/types/fieldOperations";

export type { CreateFieldOperationInput, FieldOperationsRepository } from "@/lib/data/mock/fieldOperationsStore";

/** v2.0 Checkpoint 29 — Mock-only accessors, same precedent as `core/dispatch`/`core/executionPackage`. No Supabase table exists yet for any Field Operations concept. */
export function getCoreFieldOperationsService() {
  return mockFieldOperationsRepository;
}

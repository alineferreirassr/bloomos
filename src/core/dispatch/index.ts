import { mockDispatchOrdersRepository } from "@/lib/data/mock/dispatchOrdersStore";
import { mockDispatchBatchesRepository } from "@/lib/data/mock/dispatchBatchesStore";

export type { DispatchOrder, DispatchStatus, DispatchPriority, DispatchSource } from "@/types/dispatch";
export type { DispatchAssignment, DispatchAttempt, DispatchQueueState } from "@/types/dispatch";
export type { DispatchBatch } from "@/types/dispatch";

export type { CreateDispatchOrderInput, CreateAssignmentInput, DispatchOrdersRepository } from "@/lib/data/mock/dispatchOrdersStore";
export type { CreateDispatchBatchInput, DispatchBatchesRepository } from "@/lib/data/mock/dispatchBatchesStore";

/** v2.0 Checkpoint 28 — Mock-only accessors, same precedent as `core/executionPackage`/`core/operationalPlanning`. No Supabase table exists yet for any Dispatch concept. */
export function getCoreDispatchOrdersService() {
  return mockDispatchOrdersRepository;
}

export function getCoreDispatchBatchesService() {
  return mockDispatchBatchesRepository;
}

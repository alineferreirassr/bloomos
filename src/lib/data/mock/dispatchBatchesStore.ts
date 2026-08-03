import type { DispatchBatch } from "@/types/dispatch";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 28, Step 1 — Dispatch Batch persistence. Groups multiple `DispatchOrder`s created together (e.g. every order dispatched for one event in one action) — a thin, immutable membership list, never a duplicate of `DispatchOrder` itself. Same convention as every mock store in this codebase. */
let batches: DispatchBatch[] = [];

export function resetDispatchBatchesStore(): void {
  batches = [];
}

export interface CreateDispatchBatchInput {
  name: string;
  order_ids: string[];
}

async function listBatchesForWorkspace(workspaceId: string): Promise<DispatchBatch[]> {
  return batches.filter((b) => b.workspace_id === workspaceId);
}

async function getBatchById(id: string): Promise<DispatchBatch | null> {
  return batches.find((b) => b.id === id) ?? null;
}

async function createBatch(workspaceId: string, createdBy: string, input: CreateDispatchBatchInput): Promise<DataResult<DispatchBatch>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Batch name is required." });
  if (input.order_ids.length === 0) return fail("Please fix the highlighted fields.", { order_ids: "A batch needs at least one dispatch order." });

  const created: DispatchBatch = { id: generateId("dispatch_batch"), workspace_id: workspaceId, name: input.name.trim(), order_ids: input.order_ids, created_by: createdBy, created_at: nowIso() };
  batches = [...batches, created];
  return ok(created);
}

export interface DispatchBatchesRepository {
  listBatchesForWorkspace: typeof listBatchesForWorkspace;
  getBatchById: typeof getBatchById;
  createBatch: typeof createBatch;
}

export const mockDispatchBatchesRepository: DispatchBatchesRepository = {
  listBatchesForWorkspace,
  getBatchById,
  createBatch,
};

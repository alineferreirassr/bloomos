import type { Allocation, AllocationCandidate, AllocationStrategy, AllocationStatus } from "@/types/allocation";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.1 — Allocation (proposal) persistence. Same convention as `allocationRequestsStore.ts`. */
let allocations: Allocation[] = [];

export function resetAllocationsStore(): void {
  allocations = [];
}

export interface CreateAllocationInput {
  request_id: string;
  group_id: string;
  strategy: AllocationStrategy;
  candidates: AllocationCandidate[];
}

async function listAllocationsForWorkspace(workspaceId: string): Promise<Allocation[]> {
  return allocations.filter((a) => a.workspace_id === workspaceId);
}

async function listAllocationsForRequest(requestId: string): Promise<Allocation[]> {
  return allocations.filter((a) => a.request_id === requestId);
}

async function listAllocationsForGroup(groupId: string): Promise<Allocation[]> {
  return allocations.filter((a) => a.group_id === groupId);
}

async function getAllocationById(id: string): Promise<Allocation | null> {
  return allocations.find((a) => a.id === id) ?? null;
}

async function createAllocation(workspaceId: string, createdBy: string, input: CreateAllocationInput): Promise<DataResult<Allocation>> {
  // An empty `candidates` array is a real, meaningful state — every requirement line's resource pool came up empty (e.g. an "asset"/"custom" line, or a workspace with none of the needed resource type registered) — never rejected here. Rejecting it would make the exact "no resource could be allocated at all" case `AllocationRiskEngine`'s `no_allocation_possible` finding exists to catch unrepresentable.
  const timestamp = nowIso();
  const allocation: Allocation = {
    id: generateId("allocation"),
    workspace_id: workspaceId,
    request_id: input.request_id,
    group_id: input.group_id,
    strategy: input.strategy,
    status: "draft",
    candidates: input.candidates,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    approved_at: null,
    approved_by: null,
    archived_at: null,
  };
  allocations = [...allocations, allocation];
  return ok(allocation);
}

async function updateAllocationCandidates(id: string, workspaceId: string, candidates: AllocationCandidate[]): Promise<DataResult<Allocation>> {
  const existing = allocations.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This allocation could not be found.");

  const updated: Allocation = { ...existing, candidates, status: "draft", updated_at: nowIso() };
  allocations = allocations.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function setAllocationStatus(id: string, workspaceId: string, status: AllocationStatus, approvedBy: string | null): Promise<DataResult<Allocation>> {
  const existing = allocations.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This allocation could not be found.");

  const timestamp = nowIso();
  const updated: Allocation = {
    ...existing,
    status,
    updated_at: timestamp,
    approved_at: status === "approved" ? timestamp : existing.approved_at,
    approved_by: status === "approved" ? approvedBy : existing.approved_by,
    archived_at: status === "archived" ? timestamp : null,
  };
  allocations = allocations.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

export interface AllocationsRepository {
  listAllocationsForWorkspace: typeof listAllocationsForWorkspace;
  listAllocationsForRequest: typeof listAllocationsForRequest;
  listAllocationsForGroup: typeof listAllocationsForGroup;
  getAllocationById: typeof getAllocationById;
  createAllocation: typeof createAllocation;
  updateAllocationCandidates: typeof updateAllocationCandidates;
  setAllocationStatus: typeof setAllocationStatus;
}

export const mockAllocationsRepository: AllocationsRepository = {
  listAllocationsForWorkspace,
  listAllocationsForRequest,
  listAllocationsForGroup,
  getAllocationById,
  createAllocation,
  updateAllocationCandidates,
  setAllocationStatus,
};

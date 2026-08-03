import type { AllocationRequest, AllocationRequirementLine, AllocationRequestContextType, AllocationPriority, AllocationSource } from "@/types/allocation";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.1 — Allocation Request Registry persistence. Same `let` array + `resetXStore()` convention every mock store in this codebase uses. Mock-only — no Supabase table exists yet. */
let requests: AllocationRequest[] = [];

export function resetAllocationRequestsStore(): void {
  requests = [];
}

export interface CreateAllocationRequestInput {
  context_type: AllocationRequestContextType;
  context: KnowledgeNodeRef | null;
  required_resources: AllocationRequirementLine[];
  required_starts_at: string;
  required_ends_at: string;
  calendar_id: string | null;
  priority: AllocationPriority;
  deadline: string | null;
  location_placeholder: string | null;
  special_instructions: string | null;
  bundle_id: string | null;
  source: AllocationSource;
}

async function listRequestsForWorkspace(workspaceId: string): Promise<AllocationRequest[]> {
  return requests.filter((r) => r.workspace_id === workspaceId);
}

async function getRequestById(id: string): Promise<AllocationRequest | null> {
  return requests.find((r) => r.id === id) ?? null;
}

async function createRequest(workspaceId: string, createdBy: string, input: CreateAllocationRequestInput): Promise<DataResult<AllocationRequest>> {
  if (input.required_resources.length === 0) return fail("Please fix the highlighted fields.", { required_resources: "At least one resource requirement is needed." });
  if (input.required_ends_at <= input.required_starts_at) return fail("Please fix the highlighted fields.", { required_ends_at: "End time must be after the start time." });

  const timestamp = nowIso();
  const request: AllocationRequest = {
    id: generateId("allocation_request"),
    workspace_id: workspaceId,
    context_type: input.context_type,
    context: input.context,
    required_resources: input.required_resources,
    required_starts_at: input.required_starts_at,
    required_ends_at: input.required_ends_at,
    calendar_id: input.calendar_id,
    priority: input.priority,
    deadline: input.deadline,
    location_placeholder: input.location_placeholder,
    special_instructions: input.special_instructions,
    bundle_id: input.bundle_id,
    source: input.source,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  requests = [...requests, request];
  return ok(request);
}

export interface AllocationRequestsRepository {
  listRequestsForWorkspace: typeof listRequestsForWorkspace;
  getRequestById: typeof getRequestById;
  createRequest: typeof createRequest;
}

export const mockAllocationRequestsRepository: AllocationRequestsRepository = {
  listRequestsForWorkspace,
  getRequestById,
  createRequest,
};

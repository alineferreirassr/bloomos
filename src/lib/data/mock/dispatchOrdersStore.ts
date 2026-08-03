import type { DispatchOrder, DispatchAssignment, DispatchAttempt, DispatchStatus, DispatchPriority, DispatchSource, DispatchQueueState } from "@/types/dispatch";
import type { ResourceType } from "@/types/allocation";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 28 — Dispatch Order persistence. An order is one
 * aggregate document — its `assignments[]` live inline, each carrying
 * its own `attempts[]` history — never separately-queried child stores.
 * Same `let` array + `resetXStore()` convention every mock store in
 * this codebase uses.
 */
let orders: DispatchOrder[] = [];

export function resetDispatchOrdersStore(): void {
  orders = [];
}

export interface CreateAssignmentInput {
  resource_type: ResourceType;
  resource_id: string;
  requirement_line_index: number;
}

export interface CreateDispatchOrderInput {
  execution_package_id: string;
  execution_version_id: string;
  batch_id: string | null;
  priority: DispatchPriority;
  source: DispatchSource;
  assignments: CreateAssignmentInput[];
}

async function listOrdersForWorkspace(workspaceId: string, includeArchived = false): Promise<DispatchOrder[]> {
  return orders.filter((o) => o.workspace_id === workspaceId && (includeArchived || o.status !== "archived"));
}

async function getOrderById(id: string): Promise<DispatchOrder | null> {
  return orders.find((o) => o.id === id) ?? null;
}

function buildAssignment(orderId: string, input: CreateAssignmentInput): DispatchAssignment {
  return {
    id: generateId("dispatch_assignment"),
    order_id: orderId,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    requirement_line_index: input.requirement_line_index,
    queue_state: "queued",
    reason: null,
    created_at: nowIso(),
    responded_at: null,
    expires_at: null,
    attempts: [],
  };
}

async function createOrder(workspaceId: string, createdBy: string, input: CreateDispatchOrderInput): Promise<DataResult<DispatchOrder>> {
  const timestamp = nowIso();
  const orderId = generateId("dispatch_order");
  const assignments = input.assignments.map((a) => buildAssignment(orderId, a));

  const created: DispatchOrder = {
    id: orderId,
    workspace_id: workspaceId,
    execution_package_id: input.execution_package_id,
    execution_version_id: input.execution_version_id,
    batch_id: input.batch_id,
    status: "draft",
    priority: input.priority,
    source: input.source,
    assignments,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    cancelled_at: null,
    archived_at: null,
  };
  orders = [...orders, created];
  return ok(created);
}

async function setOrderStatus(id: string, workspaceId: string, status: DispatchStatus): Promise<DataResult<DispatchOrder>> {
  const existing = orders.find((o) => o.id === id && o.workspace_id === workspaceId);
  if (!existing) return fail("This dispatch order could not be found.");

  const timestamp = nowIso();
  const updated: DispatchOrder = {
    ...existing,
    status,
    updated_at: timestamp,
    cancelled_at: status === "cancelled" ? timestamp : existing.cancelled_at,
    archived_at: status === "archived" ? timestamp : null,
  };
  orders = orders.map((o) => (o.id === id ? updated : o));
  return ok(updated);
}

/** Appends one `DispatchAttempt` to the named assignment's own history and updates its current `queue_state`/`reason`/`responded_at` — every transition (assign/present/accept/decline/expire/cancel) goes through this one function, so the attempt log and the assignment's own current state can never drift apart. */
async function transitionAssignment(orderId: string, workspaceId: string, assignmentId: string, nextState: DispatchQueueState, reason: string | null): Promise<DataResult<DispatchOrder>> {
  const existing = orders.find((o) => o.id === orderId && o.workspace_id === workspaceId);
  if (!existing) return fail("This dispatch order could not be found.");
  const assignment = existing.assignments.find((a) => a.id === assignmentId);
  if (!assignment) return fail("This dispatch assignment could not be found.");

  const timestamp = nowIso();
  const attempt: DispatchAttempt = { id: generateId("dispatch_attempt"), assignment_id: assignmentId, queue_state: nextState, reason, created_at: timestamp };
  const isTerminalResponse = nextState === "accepted" || nextState === "declined" || nextState === "expired";

  const updatedAssignment: DispatchAssignment = {
    ...assignment,
    queue_state: nextState,
    reason,
    responded_at: isTerminalResponse ? timestamp : assignment.responded_at,
    attempts: [...assignment.attempts, attempt],
  };

  const updated: DispatchOrder = { ...existing, assignments: existing.assignments.map((a) => (a.id === assignmentId ? updatedAssignment : a)), updated_at: timestamp };
  orders = orders.map((o) => (o.id === orderId ? updated : o));
  return ok(updated);
}

export interface DispatchOrdersRepository {
  listOrdersForWorkspace: typeof listOrdersForWorkspace;
  getOrderById: typeof getOrderById;
  createOrder: typeof createOrder;
  setOrderStatus: typeof setOrderStatus;
  transitionAssignment: typeof transitionAssignment;
}

export const mockDispatchOrdersRepository: DispatchOrdersRepository = {
  listOrdersForWorkspace,
  getOrderById,
  createOrder,
  setOrderStatus,
  transitionAssignment,
};

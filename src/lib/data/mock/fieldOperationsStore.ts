import type { FieldOperation, ExecutionSession, ExecutionAttempt, FieldOperationStatus, ExecutionLifecycleState } from "@/types/fieldOperations";
import type { ExecutionPriority } from "@/types/executionPackage";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 29 — Field Operation persistence. A `FieldOperation` is
 * one aggregate document — its `sessions[]` live inline, each carrying
 * its own `attempts[]` history — the exact "whole graph as one document"
 * precedent `DispatchOrder` established before it.
 */
let operations: FieldOperation[] = [];

export function resetFieldOperationsStore(): void {
  operations = [];
}

export interface CreateFieldOperationInput {
  dispatch_order_id: string;
  dispatch_assignment_id: string;
  execution_package_id: string;
  execution_version_id: string;
  priority: ExecutionPriority;
  context: KnowledgeNodeRef | null;
}

async function listOperationsForWorkspace(workspaceId: string, includeArchived = false): Promise<FieldOperation[]> {
  return operations.filter((o) => o.workspace_id === workspaceId && (includeArchived || o.status !== "archived"));
}

async function getOperationById(id: string): Promise<FieldOperation | null> {
  return operations.find((o) => o.id === id) ?? null;
}

function buildInitialSession(fieldOperationId: string): ExecutionSession {
  const timestamp = nowIso();
  return {
    id: generateId("execution_session"),
    field_operation_id: fieldOperationId,
    lifecycle_state: "created",
    outcome: null,
    reason: null,
    current_phase_id: null,
    completed_step_ids: [],
    completed_milestone_ids: [],
    completed_checklist_item_ids: [],
    completed_deliverable_ids: [],
    started_at: null,
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    attempts: [],
  };
}

async function createOperation(workspaceId: string, createdBy: string, input: CreateFieldOperationInput): Promise<DataResult<FieldOperation>> {
  const timestamp = nowIso();
  const operationId = generateId("field_operation");
  const created: FieldOperation = {
    id: operationId,
    workspace_id: workspaceId,
    dispatch_order_id: input.dispatch_order_id,
    dispatch_assignment_id: input.dispatch_assignment_id,
    execution_package_id: input.execution_package_id,
    execution_version_id: input.execution_version_id,
    priority: input.priority,
    context: input.context,
    status: "active",
    sessions: [buildInitialSession(operationId)],
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  operations = [...operations, created];
  return ok(created);
}

async function setOperationStatus(id: string, workspaceId: string, status: FieldOperationStatus): Promise<DataResult<FieldOperation>> {
  const existing = operations.find((o) => o.id === id && o.workspace_id === workspaceId);
  if (!existing) return fail("This field operation could not be found.");

  const timestamp = nowIso();
  const updated: FieldOperation = {
    ...existing,
    status,
    updated_at: timestamp,
    archived_at: status === "archived" ? timestamp : existing.archived_at,
  };
  operations = operations.map((o) => (o.id === id ? updated : o));
  return ok(updated);
}

/** Restarts a Field Operation after a prior session ended non-terminally-completed (cancelled/aborted/failed) — appends a fresh `ExecutionSession` in `created` state, never mutating the prior one. */
async function startNewSession(fieldOperationId: string, workspaceId: string): Promise<DataResult<FieldOperation>> {
  const existing = operations.find((o) => o.id === fieldOperationId && o.workspace_id === workspaceId);
  if (!existing) return fail("This field operation could not be found.");

  const session = buildInitialSession(fieldOperationId);
  const updated: FieldOperation = { ...existing, sessions: [...existing.sessions, session], updated_at: nowIso() };
  operations = operations.map((o) => (o.id === fieldOperationId ? updated : o));
  return ok(updated);
}

const TERMINAL_RESPONSE_STATES: ReadonlySet<ExecutionLifecycleState> = new Set(["completed", "cancelled", "aborted", "failed"]);

/** Appends one `ExecutionAttempt` to the named session's own history and updates its current `lifecycle_state`/`reason`/timestamps — every transition goes through this one function, so the attempt log and the session's own current state can never drift apart. */
async function transitionSession(fieldOperationId: string, workspaceId: string, sessionId: string, nextState: ExecutionLifecycleState, reason: string | null): Promise<DataResult<FieldOperation>> {
  const existing = operations.find((o) => o.id === fieldOperationId && o.workspace_id === workspaceId);
  if (!existing) return fail("This field operation could not be found.");
  const session = existing.sessions.find((s) => s.id === sessionId);
  if (!session) return fail("This execution session could not be found.");

  const timestamp = nowIso();
  const attempt: ExecutionAttempt = { id: generateId("execution_attempt"), session_id: sessionId, lifecycle_state: nextState, reason, created_at: timestamp };
  const isTerminalOutcome = TERMINAL_RESPONSE_STATES.has(nextState);

  const updatedSession: ExecutionSession = {
    ...session,
    lifecycle_state: nextState,
    reason,
    outcome: isTerminalOutcome ? (nextState as ExecutionSession["outcome"]) : session.outcome,
    started_at: nextState === "started" ? (session.started_at ?? timestamp) : session.started_at,
    paused_at: nextState === "paused" ? timestamp : session.paused_at,
    resumed_at: nextState === "resumed" ? timestamp : session.resumed_at,
    completed_at: nextState === "completed" ? timestamp : session.completed_at,
    updated_at: timestamp,
    attempts: [...session.attempts, attempt],
  };

  const updated: FieldOperation = { ...existing, sessions: existing.sessions.map((s) => (s.id === sessionId ? updatedSession : s)), updated_at: timestamp };
  operations = operations.map((o) => (o.id === fieldOperationId ? updated : o));
  return ok(updated);
}

/** Records live execution-progress overlay changes (completed step/milestone/checklist-item ids and the current phase pointer) without going through a lifecycle transition — a session can make progress while `started`/`resumed` without changing state. */
async function updateSessionProgress(fieldOperationId: string, workspaceId: string, sessionId: string, progress: { current_phase_id?: string | null; completed_step_ids?: string[]; completed_milestone_ids?: string[]; completed_checklist_item_ids?: string[]; completed_deliverable_ids?: string[] }): Promise<DataResult<FieldOperation>> {
  const existing = operations.find((o) => o.id === fieldOperationId && o.workspace_id === workspaceId);
  if (!existing) return fail("This field operation could not be found.");
  const session = existing.sessions.find((s) => s.id === sessionId);
  if (!session) return fail("This execution session could not be found.");

  const timestamp = nowIso();
  const updatedSession: ExecutionSession = {
    ...session,
    current_phase_id: progress.current_phase_id !== undefined ? progress.current_phase_id : session.current_phase_id,
    completed_step_ids: progress.completed_step_ids ?? session.completed_step_ids,
    completed_milestone_ids: progress.completed_milestone_ids ?? session.completed_milestone_ids,
    completed_checklist_item_ids: progress.completed_checklist_item_ids ?? session.completed_checklist_item_ids,
    completed_deliverable_ids: progress.completed_deliverable_ids ?? session.completed_deliverable_ids,
    updated_at: timestamp,
  };

  const updated: FieldOperation = { ...existing, sessions: existing.sessions.map((s) => (s.id === sessionId ? updatedSession : s)), updated_at: timestamp };
  operations = operations.map((o) => (o.id === fieldOperationId ? updated : o));
  return ok(updated);
}

export interface FieldOperationsRepository {
  listOperationsForWorkspace: typeof listOperationsForWorkspace;
  getOperationById: typeof getOperationById;
  createOperation: typeof createOperation;
  setOperationStatus: typeof setOperationStatus;
  startNewSession: typeof startNewSession;
  transitionSession: typeof transitionSession;
  updateSessionProgress: typeof updateSessionProgress;
}

export const mockFieldOperationsRepository: FieldOperationsRepository = {
  listOperationsForWorkspace,
  getOperationById,
  createOperation,
  setOperationStatus,
  startNewSession,
  transitionSession,
  updateSessionProgress,
};

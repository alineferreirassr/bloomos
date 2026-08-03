import type { Assignment, Worker, AssignableType } from "@/types/workforce";
import { ASSIGNABLE_TYPE_TO_NODE_TYPE } from "@/types/workforce";
import type { KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 26, Step 6 — Assignment Engine. Pure validation and
 * workload computation; the module layer (`workforceActions.ts`) is the
 * one that actually creates the Knowledge Graph relationship, records
 * Timeline activity, and checks Permissions — this file never touches
 * any of those directly, same "pure core, impure module layer" split
 * every other engine in this checkpoint series follows.
 */

export interface AssignmentValidationResult {
  allowed: boolean;
  reasons: string[];
}

/** A terminated or on-leave worker cannot receive a new assignment; an already-terminated worker's existing assignments are left alone (ending them is a separate, explicit action). */
export function isAssignmentValid(worker: Pick<Worker, "status">): AssignmentValidationResult {
  const reasons: string[] = [];
  if (worker.status === "terminated") reasons.push("A terminated worker cannot be assigned.");
  if (worker.status === "on_leave") reasons.push("A worker on leave cannot be assigned — end their leave first.");
  return { allowed: reasons.length === 0, reasons };
}

export function computeWorkerWorkload(workerId: string, assignments: Assignment[]): number {
  return assignments.filter((a) => a.worker_id === workerId && a.status === "active").length;
}

/** The subset of `AssignableType`s this checkpoint can honestly connect to a real Knowledge Graph node — `project`/`task_placeholder` are named by the spec but have no `KnowledgeNodeType` counterpart, see `types/workforce.ts`'s `ASSIGNABLE_TYPE_TO_NODE_TYPE` comment. */
export function resolveAssignableNodeType(assignableType: AssignableType): KnowledgeNodeType | null {
  return ASSIGNABLE_TYPE_TO_NODE_TYPE[assignableType] ?? null;
}

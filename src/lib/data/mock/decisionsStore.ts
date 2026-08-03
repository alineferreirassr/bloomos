import type { Decision, DecisionCategory, DecisionDependency, DecisionPriority, DecisionStatus } from "@/types/executiveDecisions";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 25.7 — Decision Registry persistence. Same `let` array +
 * `resetXStore()` convention every mock store in this codebase uses.
 * `upsertDecision` is the one addition beyond the plain-CRUD shape
 * `objectivesStore.ts` (Step 15.6) established — it exists so re-running
 * `evaluateExecutiveDecisionsAction` never spawns a duplicate Decision for
 * an issue that's already open; see `Decision.dedupe_key`'s own doc comment.
 */
let decisions: Decision[] = [];

export function resetDecisionsStore(): void {
  decisions = [];
}

export interface CreateDecisionInput {
  title: string;
  description: string;
  category: DecisionCategory;
  priority: DecisionPriority;
  reason: string;
  generated_by: string;
  related_entities: KnowledgeNodeRef[];
  related_assets: KnowledgeNodeRef[];
  related_objective_ids: string[];
  related_timeline_activity_ids: string[];
  dependencies: DecisionDependency[];
  dedupe_key: string;
}

async function listDecisionsForWorkspace(workspaceId: string, includeArchived = false): Promise<Decision[]> {
  return decisions.filter((d) => d.workspace_id === workspaceId && (includeArchived || d.status !== "archived"));
}

async function getDecisionById(id: string): Promise<Decision | null> {
  return decisions.find((d) => d.id === id) ?? null;
}

function isOpenStatus(status: DecisionStatus): boolean {
  return status !== "resolved" && status !== "archived";
}

/** Creates a new Decision, unless an open one with the same `dedupe_key` already exists in this workspace — in which case that existing row is returned untouched (its priority/score are refreshed by the caller on the next full evaluation, not by this store). */
async function upsertDecision(workspaceId: string, input: CreateDecisionInput): Promise<DataResult<Decision>> {
  const existing = decisions.find((d) => d.workspace_id === workspaceId && d.dedupe_key === input.dedupe_key && isOpenStatus(d.status));
  if (existing) return ok(existing);

  const timestamp = nowIso();
  const decision: Decision = {
    id: generateId("decision"),
    workspace_id: workspaceId,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: "open",
    reason: input.reason,
    generated_by: input.generated_by,
    created_at: timestamp,
    resolved_at: null,
    resolution_notes: null,
    related_entities: input.related_entities,
    related_assets: input.related_assets,
    related_objective_ids: input.related_objective_ids,
    related_timeline_activity_ids: input.related_timeline_activity_ids,
    dependencies: input.dependencies,
    dedupe_key: input.dedupe_key,
  };
  decisions = [...decisions, decision];
  return ok(decision);
}

async function setDecisionStatus(id: string, workspaceId: string, status: DecisionStatus, resolutionNotes: string | null): Promise<DataResult<Decision>> {
  const existing = decisions.find((d) => d.id === id && d.workspace_id === workspaceId);
  if (!existing) return fail("This decision could not be found.");

  const updated: Decision = { ...existing, status, resolved_at: status === "resolved" ? nowIso() : existing.resolved_at, resolution_notes: resolutionNotes ?? existing.resolution_notes };
  decisions = decisions.map((d) => (d.id === id ? updated : d));
  return ok(updated);
}

async function setDecisionPriority(id: string, workspaceId: string, priority: DecisionPriority): Promise<DataResult<Decision>> {
  const existing = decisions.find((d) => d.id === id && d.workspace_id === workspaceId);
  if (!existing) return fail("This decision could not be found.");

  const updated: Decision = { ...existing, priority };
  decisions = decisions.map((d) => (d.id === id ? updated : d));
  return ok(updated);
}

export interface DecisionsRepository {
  listDecisionsForWorkspace: typeof listDecisionsForWorkspace;
  getDecisionById: typeof getDecisionById;
  upsertDecision: typeof upsertDecision;
  setDecisionStatus: typeof setDecisionStatus;
  setDecisionPriority: typeof setDecisionPriority;
}

export const mockDecisionsRepository: DecisionsRepository = {
  listDecisionsForWorkspace,
  getDecisionById,
  upsertDecision,
  setDecisionStatus,
  setDecisionPriority,
};

import type { CapacityRule, CapacityScope, CapacityWindowKind } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27, Step 10 — Capacity Rule persistence. Same convention as `appointmentsStore.ts`. */
let rules: CapacityRule[] = [];

export function resetCapacityRulesStore(): void {
  rules = [];
}

export interface CreateCapacityRuleInput {
  scope: CapacityScope;
  scope_id: string | null;
  window: CapacityWindowKind;
  max_concurrent: number;
}

async function listRulesForWorkspace(workspaceId: string): Promise<CapacityRule[]> {
  return rules.filter((r) => r.workspace_id === workspaceId);
}

async function createRule(workspaceId: string, input: CreateCapacityRuleInput): Promise<DataResult<CapacityRule>> {
  if (input.max_concurrent < 1) return fail("Please fix the highlighted fields.", { max_concurrent: "Maximum concurrent must be at least 1." });
  if (input.scope !== "workspace" && input.scope_id === null) return fail("Please fix the highlighted fields.", { scope_id: "A scope id is required for this scope." });

  const timestamp = nowIso();
  const rule: CapacityRule = {
    id: generateId("capacity_rule"),
    workspace_id: workspaceId,
    scope: input.scope,
    scope_id: input.scope_id,
    window: input.window,
    max_concurrent: input.max_concurrent,
    created_at: timestamp,
    updated_at: timestamp,
  };
  rules = [...rules, rule];
  return ok(rule);
}

export interface CapacityRulesRepository {
  listRulesForWorkspace: typeof listRulesForWorkspace;
  createRule: typeof createRule;
}

export const mockCapacityRulesRepository: CapacityRulesRepository = {
  listRulesForWorkspace,
  createRule,
};

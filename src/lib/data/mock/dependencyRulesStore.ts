import type { DependencyRule, ResourceType } from "@/types/allocation";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.1, Step 8 — Dependency Rule registry persistence. Reusable registry data (e.g. "Drone equipment requires a certified operator"), never a per-request requirement — same convention as `allocationRequestsStore.ts`. */
let rules: DependencyRule[] = [];

export function resetDependencyRulesStore(): void {
  rules = [];
}

export interface CreateDependencyRuleInput {
  subject_resource_type: ResourceType;
  subject_identifier: string | null;
  requires_resource_type: ResourceType;
  requires_skill: string | null;
  requires_certification: string | null;
  description: string;
}

async function listRulesForWorkspace(workspaceId: string): Promise<DependencyRule[]> {
  return rules.filter((r) => r.workspace_id === workspaceId);
}

async function createRule(workspaceId: string, input: CreateDependencyRuleInput): Promise<DataResult<DependencyRule>> {
  if (!input.description.trim()) return fail("Please fix the highlighted fields.", { description: "A description is required." });
  if (input.requires_skill === null && input.requires_certification === null) return fail("Please fix the highlighted fields.", { requires_skill: "A dependency needs at least a required skill or certification." });

  const rule: DependencyRule = {
    id: generateId("dependency_rule"),
    workspace_id: workspaceId,
    subject_resource_type: input.subject_resource_type,
    subject_identifier: input.subject_identifier,
    requires_resource_type: input.requires_resource_type,
    requires_skill: input.requires_skill,
    requires_certification: input.requires_certification,
    description: input.description.trim(),
  };
  rules = [...rules, rule];
  return ok(rule);
}

export interface DependencyRulesRepository {
  listRulesForWorkspace: typeof listRulesForWorkspace;
  createRule: typeof createRule;
}

export const mockDependencyRulesRepository: DependencyRulesRepository = {
  listRulesForWorkspace,
  createRule,
};

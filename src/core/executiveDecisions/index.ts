import { mockDecisionsRepository } from "@/lib/data/mock/decisionsStore";

export type { Decision, DecisionStatus, DecisionPriority, DecisionCategory, DecisionDependency } from "@/types/executiveDecisions";
export type { CreateDecisionInput, DecisionsRepository } from "@/lib/data/mock/decisionsStore";

/** Mock-only accessor — no Supabase table exists yet, same precedent as `core/objectives`/`core/comments`/`core/knowledge`. */
export function getCoreDecisionsService() {
  return mockDecisionsRepository;
}

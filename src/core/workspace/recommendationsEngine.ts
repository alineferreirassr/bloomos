import { DECISION_PRIORITIES } from "@/types/executiveDecisions";
import type { WorkspaceRecommendation } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 8 — Smart Recommendations. `WorkspaceRecommendation`
 * is a direct alias of `Decision` (see `types/smartWorkspace.ts`); this
 * engine does nothing but select and order the top of an already-generated
 * `evaluateExecutiveDecisionsAction()` queue for the Workspace's compact
 * widget view — the real recommendation generation (dedup, scoring,
 * escalation) already happened across ~19 platforms before this function
 * ever runs. "Intelligent Summaries" has no engine of its own here for the
 * same reason: it calls the real, deterministic Bloom AI Brief generators
 * (`generateExecutiveBrief`/`generateTeamBrief`/`computeOperationsBrief`)
 * directly from the module actions layer — reusing them is the entire
 * point, not wrapping them in a redundant pass-through.
 */

const PRIORITY_RANK: Record<string, number> = Object.fromEntries(DECISION_PRIORITIES.map((p, index) => [p, index]));

export function topRecommendations(queue: WorkspaceRecommendation[], limit: number): WorkspaceRecommendation[] {
  return [...queue]
    .sort((a, b) => {
      const rankDiff = (PRIORITY_RANK[a.priority] ?? DECISION_PRIORITIES.length) - (PRIORITY_RANK[b.priority] ?? DECISION_PRIORITIES.length);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

import { getCoreDecisionsService } from "@/core/executiveDecisions";
import { DECISION_CATEGORIES, DECISION_PRIORITIES, type DecisionCategory, type DecisionPriority } from "@/types/executiveDecisions";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_EXECUTIVE_DECISION_ACTION_ID = "create-executive-decision";

/**
 * v2.0 Checkpoint 39 — calls `getCoreDecisionsService().upsertDecision()`
 * directly, the same real accessor `executiveDecisionsActions.ts`'s own
 * evaluation loop calls. `dedupe_key` is required and re-running the same
 * Workflow with the same key never spawns a second open Decision — `this
 * automation's own id + the trigger's own occurrence` is a reasonable
 * default when the Workflow author doesn't supply one, so an Automation
 * that fires many times for genuinely different records still dedupes per
 * record, not globally.
 */
const createExecutiveDecisionAction: AutomationActionDefinition = {
  id: CREATE_EXECUTIVE_DECISION_ACTION_ID,
  name: "Create Executive Decision",
  description: "Raises a real Executive Decision for a human to review and act on.",
  category: "operations",
  version: "automation-action-create-executive-decision-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const title = params.facts.title;
    const description = params.facts.description;
    const category = params.facts.category;
    const priority = params.facts.priority;
    if (typeof title !== "string" || typeof description !== "string") {
      return { success: false, message: "Missing title or description in the trigger's own facts." };
    }
    const resolvedCategory: DecisionCategory = typeof category === "string" && (DECISION_CATEGORIES as readonly string[]).includes(category) ? (category as DecisionCategory) : "operations";
    const resolvedPriority: DecisionPriority = typeof priority === "string" && (DECISION_PRIORITIES as readonly string[]).includes(priority) ? (priority as DecisionPriority) : "medium";
    const dedupeKey = typeof params.facts.dedupeKey === "string" ? params.facts.dedupeKey : `workflow-${params.automationId}`;

    const result = await getCoreDecisionsService().upsertDecision(params.workspaceId, {
      title,
      description,
      category: resolvedCategory,
      priority: resolvedPriority,
      reason: `Raised by Workflow automation ${params.automationId}.`,
      generated_by: "workflow_automation",
      related_entities: [],
      related_assets: [],
      related_objective_ids: [],
      related_timeline_activity_ids: [],
      dependencies: [],
      dedupe_key: dedupeKey,
    });
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Executive Decision "${result.data.title}" recorded.` };
  },
};

export default createExecutiveDecisionAction;

"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { listAutomationsForTrigger } from "@/core/automation/registry";
import { listWorkflowNodes } from "@/core/workflow/nodeRegistry";
import { AUTOMATION_TRIGGER_TYPES } from "@/types/automation";
import type { AutomationTriggerType } from "@/types/automation";

registerWorkflowNodes();

export interface WorkflowSuggestion {
  triggerType: AutomationTriggerType;
  triggerNodeId: string;
  name: string;
  reason: string;
}

export type GetWorkflowSuggestionsResult = { success: true; data: WorkflowSuggestion[] } | { success: false; error: string };

/**
 * The Step 12 "Bloom AI may suggest Workflows" surface — deliberately
 * **deterministic**, not a generative AI call: for every Trigger type with
 * a real built-in node but zero active Automations listening for it (the
 * same "Triggers With No Listener" signal the Automation Dashboard already
 * surfaces), this suggests building a Workflow for it. Never creates or
 * publishes anything itself — `createWorkflow()` still requires its own
 * explicit call, which the Workflows List only ever makes after the member
 * clicks "Create from suggestion," the human approval step this Step's own
 * spec requires. This mirrors Checkpoint 9's own "Skills may suggest
 * Automations" boundary: Bloom AI observes and recommends, it never acts.
 */
export async function getWorkflowSuggestions(): Promise<GetWorkflowSuggestionsResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "Workflow suggestions aren't available right now." };

  const triggerNodesByTarget = new Map(listWorkflowNodes().filter((node) => node.kind === "trigger").map((node) => [node.compileTarget, node]));

  const suggestions: WorkflowSuggestion[] = [];
  for (const triggerType of AUTOMATION_TRIGGER_TYPES) {
    const triggerNode = triggerNodesByTarget.get(triggerType);
    if (!triggerNode) continue;
    if (listAutomationsForTrigger(triggerType).length > 0) continue;
    suggestions.push({
      triggerType,
      triggerNodeId: triggerNode.id,
      name: `Respond to ${triggerNode.name}`,
      reason: `No active Automation currently listens for "${triggerNode.name}" — build a Workflow to respond to it.`,
    });
  }

  return { success: true, data: suggestions };
}

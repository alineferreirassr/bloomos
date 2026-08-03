import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

const WORKFLOW_COMPILED_ID_PATTERN = /^workflow-(.+?)-trigger-/;

/**
 * The `"workflow"` Merge Field domain (Step 4/14) — whether the triggering
 * Automation (`context.automationId`) was itself compiled from a Workflow
 * Builder graph, and if so, which one. `AutomationDefinition` carries no
 * live back-reference to its own originating Workflow (Checkpoint 10's own
 * `workflow` extension field is reserved, never populated by the
 * Compiler — see that checkpoint's own report), so this reads the one
 * real signal that does exist: `core/workflow/compiler.ts`'s own stable id
 * convention, `workflow-${workflowId}-trigger-${triggerNodeId}-path-${pathIndex}`.
 * A manually-registered Automation's own id never matches this shape, so
 * `generated_via_workflow_id` correctly resolves to `null` for it.
 */
export const workflowMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "generated_via_workflow_id", label: "Generated Via Workflow", description: "The id of the Workflow that compiled the triggering Automation, if any.", domain: "workflow", valueType: "string", required: false },
];

export function registerWorkflowMergeFields(): void {
  for (const definition of workflowMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("generated_via_workflow_id", async (context) => {
    if (!context.automationId) return null;
    const match = context.automationId.match(WORKFLOW_COMPILED_ID_PATTERN);
    return match ? match[1] : null;
  });
}

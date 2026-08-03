import { registerWorkflowNode } from "@/core/workflow/nodeRegistry";
import { controlNodes } from "@/modules/workflow/nodes/controlNodes";
import { triggerNodes } from "@/modules/workflow/nodes/triggerNodes";
import { conditionNodes } from "@/modules/workflow/nodes/conditionNodes";
import { actionNodes } from "@/modules/workflow/nodes/actionNodes";
import { approvalNodes } from "@/modules/workflow/nodes/approvalNodes";
import { buildSkillActionNodes } from "@/modules/workflow/nodes/skillActionNodes";

let registered = false;

/**
 * Registers every built-in node type — Checkpoint 10's own 30 (2 control,
 * 9 trigger, 6 condition, 9 action, 4 approval), plus Checkpoint 13's own
 * additions: 4 more Trigger nodes (Event Created, New Client, Manual,
 * Timer), 4 more Condition nodes (If, Compare, Exists, Switch), 1 more
 * Action node (Custom Action), and one dynamically-generated Action node
 * per real, runnable Skill (`skillActionNodes.ts` — Step 9's own "discover
 * Skills from the Skill Registry"), so the exact total varies with however
 * many Skills are currently registered. Idempotent, the same module-level
 * guard every other registration function in this codebase already uses.
 * Per Step 17's own Developer Experience guarantee, a future *static* node
 * type still needs only its own definition plus one addition to the
 * spread below — nothing here needs to change for a new Skill, that's
 * `skillActionNodes.ts`'s own job.
 */
export function registerWorkflowNodes(): void {
  if (registered) return;
  for (const definition of [...controlNodes, ...triggerNodes, ...conditionNodes, ...actionNodes, ...approvalNodes, ...buildSkillActionNodes()]) {
    registerWorkflowNode(definition);
  }
  registered = true;
}

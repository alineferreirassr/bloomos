import type { AutomationActionDefinition, AutomationActionResultDetail } from "@/types/automation";

export const DELAY_ACTION_ID = "delay";

/**
 * v2.0 Checkpoint 39 addendum — the Workflow Studio's own Delay/Wait node
 * compiles to this real, registered Action, so a Delay step is a genuine
 * part of the compiled Automation's own `actionIds` chain (unlike Custom
 * Action, which is `compileTarget: null` and contributes nothing real).
 * BloomOS has no background job scheduler anywhere in this codebase (the
 * same honest gap `WorkflowInspectorPanel`'s own Scheduled Execution
 * section already discloses) — so this Action cannot actually pause
 * mid-chain. It completes immediately, and says so, rather than silently
 * pretending to wait. The node's own `durationMinutes` (set in the
 * Properties Panel) is recorded on the graph for planning/documentation
 * and shown in the Simulator's own estimated-duration total, but isn't
 * enforced here — an honest limitation, not a bug.
 */
const delayAction: AutomationActionDefinition = {
  id: DELAY_ACTION_ID,
  name: "Delay",
  description: "Records a planned wait step. Completes immediately — BloomOS has no background scheduler yet, so the delay itself isn't enforced.",
  category: "general",
  version: "automation-action-delay-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(): Promise<AutomationActionResultDetail> {
    return { success: true, message: "Delay step reached — completed immediately (no real wait; BloomOS has no background scheduler yet)." };
  },
};

export default delayAction;

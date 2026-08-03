import { validateWorkflow } from "@/core/workflow/validation";
import { compileWorkflow } from "@/core/workflow/compiler";
import { getWorkflowManager } from "@/core/workflow/manager";
import { registerAutomation, unregisterAutomation, getAutomation } from "@/core/automation/registry";
import { getLogger } from "@/core/observability/logger";
import type { Workflow, WorkflowIssue, WorkflowVersion } from "@/types/workflow";
import type { DataResult } from "@/lib/data/result";

/**
 * The Step 10 "Automation Integration" — the **only** place a Workflow's
 * graph ever reaches the Automation Engine, and the only file in the
 * Workflow Builder permitted to import `core/automation/registry`. It calls
 * `registerAutomation()` — the same call any hand-written
 * `registerXAutomation()` file already makes — and nothing else from
 * `core/automation`. In particular, **never** `executeAutomation()` or
 * `dispatchAutomationTrigger()` (`core/automation/resolver.ts`): the
 * Workflow Builder designs Automations, it never runs one. A repo-wide grep
 * for `core/automation/resolver` under `core/workflow`/`modules/workflow`
 * should always come back empty — see this checkpoint's own test suite for
 * that proof.
 */

export type PublishWorkflowResult = { success: true; version: WorkflowVersion } | { success: false; error: string; issues?: WorkflowIssue[] };

export async function publishWorkflow(workflowId: string, publishedBy: string): Promise<PublishWorkflowResult> {
  const manager = getWorkflowManager();
  const workflow = await manager.getWorkflowById(workflowId);
  if (!workflow) return { success: false, error: "This Workflow isn't available. It may not exist, or you may not have access to it." };
  if (workflow.status === "archived") return { success: false, error: "An archived Workflow can't be published — unarchive it first." };

  const validation = validateWorkflow(workflow.graph);
  if (!validation.valid) {
    getLogger().warn("Workflow publish blocked by validation", { workflowId, issueCount: validation.issues.length });
    return { success: false, error: "This Workflow has validation errors and can't be published yet.", issues: validation.issues };
  }

  const nextVersionNumber = workflow.currentVersion + 1;
  const compilation = compileWorkflow({
    workflowId: workflow.id,
    version: nextVersionNumber,
    graph: workflow.graph,
    metadata: workflow.metadata,
    executionPolicy: workflow.executionPolicy,
  });
  if (!compilation.success) {
    // Unreachable in practice — `validateWorkflow` already ran the same
    // structural analysis the Compiler itself runs — kept as a defensive,
    // structured failure rather than an assumption the two can never drift.
    getLogger().error("Workflow compile failed after passing validation", { workflowId, issueCount: compilation.issues.length });
    return { success: false, error: "This Workflow could not be compiled.", issues: compilation.issues };
  }

  // A re-publish may have removed a Trigger or an entire path from the
  // graph — unregister the *previous* version's own compiled Automations
  // first, so a stale one never lingers in the Registry under an id nothing
  // in the current graph produces anymore.
  if (workflow.currentVersion > 0) {
    const previousVersion = await manager.getWorkflowVersion(workflow.id, workflow.currentVersion);
    for (const automationId of previousVersion?.compiledAutomationIds ?? []) {
      unregisterAutomation(automationId);
    }
  }

  for (const automation of compilation.automations) {
    registerAutomation(automation);
  }

  const versionResult = await manager.recordPublishedVersion(workflow.id, {
    graph: workflow.graph,
    metadata: workflow.metadata,
    executionPolicy: workflow.executionPolicy,
    compiledAutomationIds: compilation.automations.map((automation) => automation.id),
    publishedBy,
  });
  if (!versionResult.success) return { success: false, error: versionResult.error };

  return { success: true, version: versionResult.data };
}

/**
 * Archiving a Workflow must not leave its own last-published Automations
 * silently running forever — each is flipped to `status: "disabled"` (never
 * unregistered outright, so it stays discoverable in the Registry, matching
 * `AutomationDefinition.status`'s own "still discoverable, never dispatched"
 * contract from Checkpoint 9) before the Workflow itself is archived.
 */
export async function archiveWorkflowAndDisableAutomations(workflowId: string): Promise<DataResult<Workflow>> {
  const manager = getWorkflowManager();
  const workflow = await manager.getWorkflowById(workflowId);
  if (workflow && workflow.currentVersion > 0) {
    await setCompiledAutomationsStatus(workflow.id, workflow.currentVersion, "disabled");
  }
  return manager.archiveWorkflow(workflowId);
}

/** The reverse of `archiveWorkflowAndDisableAutomations` — re-enables the last-published version's own Automations before unarchiving. */
export async function unarchiveWorkflowAndEnableAutomations(workflowId: string): Promise<DataResult<Workflow>> {
  const manager = getWorkflowManager();
  const workflow = await manager.getWorkflowById(workflowId);
  if (workflow && workflow.currentVersion > 0) {
    await setCompiledAutomationsStatus(workflow.id, workflow.currentVersion, "active");
  }
  return manager.unarchiveWorkflow(workflowId);
}

async function setCompiledAutomationsStatus(workflowId: string, version: number, status: "active" | "disabled"): Promise<void> {
  const record = await getWorkflowManager().getWorkflowVersion(workflowId, version);
  for (const automationId of record?.compiledAutomationIds ?? []) {
    const automation = getAutomation(automationId);
    if (automation) registerAutomation({ ...automation, status });
  }
}

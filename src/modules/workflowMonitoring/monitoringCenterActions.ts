"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getAutomationManager } from "@/core/automation/manager";
import { getAutomation, listAutomations } from "@/core/automation/registry";
import { executeAutomation } from "@/core/automation/resolver";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { computeWorkflowLiveMonitor, type WorkflowLiveMonitorSnapshot } from "@/core/workflowMonitoring/liveMonitor";
import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import { collectWorkflowErrors } from "@/core/workflowMonitoring/errorCenter";
import { computeWorkflowPerformanceMetrics } from "@/core/workflowMonitoring/performanceEngine";
import { computeWorkflowDependencyMap } from "@/core/workflowMonitoring/dependencyMap";
import { computeWorkspaceWorkflowHealth } from "@/core/workflowMonitoring/healthEngine";
import { buildWorkflowAuditRecords } from "@/core/workflowMonitoring/auditEngine";
import { getWorkflowErrorAcknowledgement, setWorkflowErrorAcknowledgement, type WorkflowErrorAcknowledgementStatus } from "@/lib/data/mock/workflowErrorAcknowledgementsStore";
import { nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import type { AutomationExecution, AutomationTriggerEvent } from "@/types/automation";
import type {
  WorkflowAuditRecord,
  WorkflowDependencyMap,
  WorkflowErrorRecord,
  WorkflowExecutionSummary,
  WorkflowPerformanceMetrics,
  WorkspaceWorkflowHealthSummary,
} from "@/types/workflowMonitoring";

const GENERIC_ACCESS_ERROR = "The Workflow Monitoring Center isn't available. You may not have access to it.";
const ELEVATED_PERMISSION_ERROR = "The Workflow Monitoring Center requires the workspace management permission.";
const EXECUTION_HISTORY_LIMIT = 500;

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — the module actions layer for the
 * Workflow Monitoring Center. Every query fetches Automation History +
 * the Automation Registry + the Workflow store exactly once and feeds the
 * pure engines in `core/workflowMonitoring/` — mirroring
 * `businessHealthActions.ts`'s own "fetch once, feed every engine" shape.
 * Piggybacks on `workspace.manage`, the same permission every other
 * Workflow/Automation action already requires.
 */

interface MonitoringContext {
  workspaceId: string;
  workflows: Awaited<ReturnType<typeof fetchWorkflows>>;
  executions: AutomationExecution[];
  automations: ReturnType<typeof listAutomations>;
}

async function fetchWorkflows(workspaceId: string) {
  return getWorkflowManager().listWorkflows(workspaceId);
}

async function loadMonitoringContext(workspaceId: string): Promise<MonitoringContext> {
  const [workflows, executions] = await Promise.all([fetchWorkflows(workspaceId), getAutomationManager().getRecentExecutions(workspaceId, EXECUTION_HISTORY_LIMIT)]);
  return { workspaceId, workflows, executions, automations: listAutomations() };
}

async function requireMonitoringAccess(): Promise<{ success: true; context: MonitoringContext } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: ELEVATED_PERMISSION_ERROR };
  return { success: true, context: await loadMonitoringContext(session.workspace.id) };
}

async function computeDisabledWorkflowIds(context: MonitoringContext): Promise<Set<string>> {
  const flagged = context.workflows.filter((workflow) => workflow.executionPolicy.featureFlag !== null);
  const evaluations = await Promise.all(flagged.map(async (workflow) => ({ id: workflow.id, enabled: await evaluateFeatureFlag(context.workspaceId, workflow.executionPolicy.featureFlag!) })));
  return new Set(evaluations.filter((entry) => !entry.enabled).map((entry) => entry.id));
}

function computeUsedWorkflowIds(context: MonitoringContext): Set<string> {
  return new Set(
    buildWorkflowExecutionSummaries(context.executions, context.automations)
      .map((summary) => summary.workflowId)
      .filter((id): id is string => id !== null),
  );
}

// ---------------------------------------------------------------------------
// Live Execution Monitor (Task #750)
// ---------------------------------------------------------------------------
export type GetWorkflowLiveMonitorResult = { success: true; data: WorkflowLiveMonitorSnapshot } | { success: false; error: string };

export async function getWorkflowLiveMonitorAction(): Promise<GetWorkflowLiveMonitorResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;
  return { success: true, data: computeWorkflowLiveMonitor(context.executions, context.automations, context.workflows, nowIso()) };
}

// ---------------------------------------------------------------------------
// Execution History (Task #751)
// ---------------------------------------------------------------------------
export interface WorkflowExecutionHistoryFilters {
  workflowId?: string;
  bucket?: WorkflowExecutionSummary["bucket"];
  /** Case-insensitive match against workflow name or execution id. */
  searchText?: string;
}

export type GetWorkflowExecutionHistoryResult = { success: true; data: WorkflowExecutionSummary[] } | { success: false; error: string };

export async function getWorkflowExecutionHistoryAction(filters: WorkflowExecutionHistoryFilters = {}): Promise<GetWorkflowExecutionHistoryResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;

  let summaries = buildWorkflowExecutionSummaries(context.executions, context.automations);
  if (filters.workflowId) summaries = summaries.filter((summary) => summary.workflowId === filters.workflowId);
  if (filters.bucket) summaries = summaries.filter((summary) => summary.bucket === filters.bucket);
  if (filters.searchText) {
    const needle = filters.searchText.toLowerCase();
    summaries = summaries.filter((summary) => summary.workflowName.toLowerCase().includes(needle) || summary.executionId.toLowerCase().includes(needle));
  }

  return { success: true, data: summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
}

/** The Execution Graph / Execution Logs the addendum names — both already ARE `WorkflowExecutionSummary.executionPath` and `.actionResults` respectively, real data already returned by the history query above; no separate query needed. Replay reuses the existing Simulator's own step-preview shape — see Task #746 `simulateWorkflowAction`, composed by the UI layer directly against the Workflow this execution's `workflowId` names. */

export type GetWorkflowExecutionByIdResult = { success: true; data: WorkflowExecutionSummary } | { success: false; error: string };

export async function getWorkflowExecutionByIdAction(executionId: string): Promise<GetWorkflowExecutionByIdResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const summary = buildWorkflowExecutionSummaries(access.context.executions, access.context.automations).find((entry) => entry.executionId === executionId);
  if (!summary) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: summary };
}

async function rerunExecution(executionId: string): Promise<{ success: true; data: AutomationExecution } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: ELEVATED_PERMISSION_ERROR };

  const manager = getAutomationManager();
  const past = await manager.getExecutionById(executionId);
  if (!past || past.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const automation = getAutomation(past.automationId);
  if (!automation) return { success: false, error: "The Automation this execution ran through is no longer registered." };

  const trigger: AutomationTriggerEvent = { type: past.trigger, workspaceId: past.workspaceId, occurredAt: nowIso(), actorMemberId: session.user.id, facts: past.triggerFacts };

  const execution = await executeAutomation({
    automation,
    trigger,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? null,
    role: session.membership.role,
    permissions: session.permissions,
  });
  getLogger().info("Workflow execution re-run from Monitoring Center", { originalExecutionId: executionId, newExecutionId: execution.id, automationId: automation.id });
  return { success: true, data: execution };
}

/** "Retry execution" — re-runs the same real Automation through the one real `executeAutomation()` entry point, using the original execution's own recorded `triggerFacts`. Never a second execution engine. */
export async function retryWorkflowExecutionAction(executionId: string): Promise<{ success: true; data: AutomationExecution } | { success: false; error: string }> {
  return rerunExecution(executionId);
}

/** "Clone execution" — functionally identical composition to retry (BloomOS's synchronous engine has no separate "queued copy" concept): a fresh, independent execution record produced from the same real inputs. */
export async function cloneWorkflowExecutionAction(executionId: string): Promise<{ success: true; data: AutomationExecution } | { success: false; error: string }> {
  return rerunExecution(executionId);
}

/** "Export execution log" — the real `WorkflowAuditRecord` for one execution, serialized as JSON. */
export async function exportWorkflowExecutionLogAction(executionId: string): Promise<{ success: true; data: string } | { success: false; error: string }> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const record = buildWorkflowAuditRecords(access.context.executions, access.context.automations).find((entry) => entry.executionId === executionId);
  if (!record) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: JSON.stringify(record, null, 2) };
}

// ---------------------------------------------------------------------------
// Error Center (Task #752)
// ---------------------------------------------------------------------------
export interface WorkflowErrorRecordWithStatus extends WorkflowErrorRecord {
  acknowledgement: WorkflowErrorAcknowledgementStatus;
}

export type GetWorkflowErrorsResult = { success: true; data: WorkflowErrorRecordWithStatus[] } | { success: false; error: string };

export async function getWorkflowErrorsAction(): Promise<GetWorkflowErrorsResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const errors = collectWorkflowErrors(access.context.executions, access.context.automations);
  return { success: true, data: errors.map((error) => ({ ...error, acknowledgement: getWorkflowErrorAcknowledgement(error.executionId, error.actionId) })) };
}

/**
 * Phase 09B — `executionId` names an `AutomationExecution`, which is the
 * only place workspace ownership for this action/error pair actually
 * lives (a `WorkflowErrorRecord`'s `actionId` isn't itself a stored,
 * ownable entity). Ownership is therefore derived the same way
 * `rerunExecution()` already does it just above — by loading the real
 * execution and comparing its `workspaceId` to the caller's own session,
 * never a client-supplied workspace id — closing the gap where any
 * Owner/Admin who learned another workspace's `executionId`/`actionId`
 * could flip its acknowledgement flag.
 */
async function setErrorAcknowledgement(executionId: string, actionId: string, status: WorkflowErrorAcknowledgementStatus): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: ELEVATED_PERMISSION_ERROR };

  const execution = await getAutomationManager().getExecutionById(executionId);
  if (!execution || execution.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  setWorkflowErrorAcknowledgement(executionId, actionId, status);
  getLogger().info("Workflow error acknowledgement set", { executionId, actionId, status, workspaceId: session.workspace.id });
  return { success: true };
}

export async function ignoreWorkflowErrorAction(executionId: string, actionId: string) {
  return setErrorAcknowledgement(executionId, actionId, "ignored");
}

export async function archiveWorkflowErrorAction(executionId: string, actionId: string) {
  return setErrorAcknowledgement(executionId, actionId, "archived");
}

// ---------------------------------------------------------------------------
// Performance Dashboard (Task #753)
// ---------------------------------------------------------------------------
export type GetWorkflowPerformanceMetricsResult = { success: true; data: WorkflowPerformanceMetrics } | { success: false; error: string };

export async function getWorkflowPerformanceMetricsAction(): Promise<GetWorkflowPerformanceMetricsResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;
  return { success: true, data: computeWorkflowPerformanceMetrics(context.executions, context.automations, nowIso()) };
}

// ---------------------------------------------------------------------------
// Dependency Map (Task #754)
// ---------------------------------------------------------------------------
export type GetWorkflowDependencyMapResult = { success: true; data: WorkflowDependencyMap } | { success: false; error: string };

export async function getWorkflowDependencyMapAction(): Promise<GetWorkflowDependencyMapResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;
  return { success: true, data: computeWorkflowDependencyMap(context.automations, context.workflows, nowIso()) };
}

// ---------------------------------------------------------------------------
// Health Panel (Task #755)
// ---------------------------------------------------------------------------
export type GetWorkspaceWorkflowHealthResult = { success: true; data: WorkspaceWorkflowHealthSummary } | { success: false; error: string };

export async function getWorkspaceWorkflowHealthAction(): Promise<GetWorkspaceWorkflowHealthResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;
  const [usedWorkflowIds, disabledWorkflowIds] = await Promise.all([Promise.resolve(computeUsedWorkflowIds(context)), computeDisabledWorkflowIds(context)]);
  return { success: true, data: computeWorkspaceWorkflowHealth(context.workflows, { usedWorkflowIds, disabledWorkflowIds }, nowIso()) };
}

// ---------------------------------------------------------------------------
// Workflow Audit (Task #756)
// ---------------------------------------------------------------------------
export type GetWorkflowAuditLogResult = { success: true; data: WorkflowAuditRecord[] } | { success: false; error: string };

export async function getWorkflowAuditLogAction(): Promise<GetWorkflowAuditLogResult> {
  const access = await requireMonitoringAccess();
  if (!access.success) return access;
  const { context } = access;
  return { success: true, data: buildWorkflowAuditRecords(context.executions, context.automations).sort((a, b) => b.timestamp.localeCompare(a.timestamp)) };
}

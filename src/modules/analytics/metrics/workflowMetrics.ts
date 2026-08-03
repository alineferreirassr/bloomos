import { getAutomationManager } from "@/core/automation/manager";
import { listWorkflowSimulationRuns } from "@/lib/data/core/workflow/simulationStore";
import { registerMetric } from "@/core/analytics/metricRegistry";
import { buildMetricResult, filterInWindow, groupByDay } from "@/core/analytics/engine";
import type { MetricComputeContext, MetricComputeResult } from "@/types/analytics";

/**
 * Checkpoint 15 — Workflow category metrics. Executions/Failure rate read
 * the exact same `AutomationExecution` records `getAutomationDashboardData.ts`
 * already computes stats from — that file's own comment explicitly calls
 * a "real analytics rollup" a future checkpoint's job; this is that
 * future checkpoint. `EXECUTION_LIMIT` is generous (not literally
 * unbounded) for the same "good enough for this checkpoint's own
 * mock-repository scale" reason that file already documents. Simulation
 * usage reads the new `workflowSimulationStore.ts` (Step 7's own real
 * tracking, added this checkpoint — see that file's own doc comment).
 * "Most common actions" and "Template usage" have no queryable historical
 * data source today (`AutomationActionExecutionResult.actionId` exists,
 * but no per-Workflow "created from template X" record does) — Template
 * usage is intentionally left unregistered rather than fabricated; see
 * docs/analytics.md's own "Known limitations."
 */

const EXECUTION_LIMIT = 10000;

const workflowExecutions = {
  id: "workflow.executions",
  name: "Workflow Executions",
  description: "Automation executions triggered by a published Workflow within the selected window.",
  category: "workflow" as const,
  unit: "count" as const,
  icon: "Play",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const executions = await getAutomationManager().getRecentExecutions(context.workspaceId, EXECUTION_LIMIT);
    const dateOf = (execution: (typeof executions)[number]) => execution.startedAt;
    const current = filterInWindow(executions, dateOf, context.window).length;
    const previous = filterInWindow(executions, dateOf, context.previousWindow).length;
    const series = groupByDay(executions, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

const workflowFailureRate = {
  id: "workflow.failureRate",
  name: "Failure Rate",
  description: "Share of executions within the window that failed.",
  category: "workflow" as const,
  unit: "percent" as const,
  icon: "AlertOctagon",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const executions = await getAutomationManager().getRecentExecutions(context.workspaceId, EXECUTION_LIMIT);
    const dateOf = (execution: (typeof executions)[number]) => execution.startedAt;

    const rateFor = (window: typeof context.window): number => {
      const cohort = filterInWindow(executions, dateOf, window);
      if (cohort.length === 0) return 0;
      const failed = cohort.filter((execution) => execution.status === "failure" || execution.status === "partial_failure").length;
      return (failed / cohort.length) * 100;
    };

    return buildMetricResult(rateFor(context.window), rateFor(context.previousWindow));
  },
};

const simulationUsage = {
  id: "workflow.simulationUsage",
  name: "Simulation Usage",
  description: "Times a Workflow's own Execution Simulator was run within the selected window.",
  category: "workflow" as const,
  unit: "count" as const,
  icon: "FlaskConical",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  refreshPolicy: "realtime" as const,
  async compute(context: MetricComputeContext): Promise<MetricComputeResult> {
    const runs = listWorkflowSimulationRuns(context.workspaceId);
    const dateOf = (run: (typeof runs)[number]) => run.occurred_at;
    const current = filterInWindow(runs, dateOf, context.window).length;
    const previous = filterInWindow(runs, dateOf, context.previousWindow).length;
    const series = groupByDay(runs, dateOf, () => 1, context.window);
    return buildMetricResult(current, previous, series);
  },
};

let registered = false;

export function registerWorkflowMetrics(): void {
  if (registered) return;
  registerMetric(workflowExecutions);
  registerMetric(workflowFailureRate);
  registerMetric(simulationUsage);
  registered = true;
}

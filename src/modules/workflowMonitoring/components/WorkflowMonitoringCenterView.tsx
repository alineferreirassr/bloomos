"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { AutomationIcon, AnalyticsIcon } from "@/components/ui/icons";
import {
  getWorkflowLiveMonitorAction,
  getWorkflowExecutionHistoryAction,
  getWorkflowErrorsAction,
  getWorkflowPerformanceMetricsAction,
  getWorkflowDependencyMapAction,
  getWorkspaceWorkflowHealthAction,
  getWorkflowAuditLogAction,
  retryWorkflowExecutionAction,
  cloneWorkflowExecutionAction,
  exportWorkflowExecutionLogAction,
  ignoreWorkflowErrorAction,
  archiveWorkflowErrorAction,
  type WorkflowErrorRecordWithStatus,
} from "@/modules/workflowMonitoring/monitoringCenterActions";
import type { WorkflowLiveMonitorSnapshot } from "@/core/workflowMonitoring/liveMonitor";
import type {
  WorkflowAuditRecord,
  WorkflowDependencyMap,
  WorkflowExecutionBucket,
  WorkflowExecutionSummary,
  WorkflowPerformanceMetrics,
  WorkspaceWorkflowHealthSummary,
} from "@/types/workflowMonitoring";

type Tab = "live" | "errors" | "history" | "audit" | "health" | "performance" | "dependencies";

/**
 * Order matters here: "what failed / what's running / what needs review /
 * what happened" first (Live, Errors, History, Audit), the more assessive
 * Health panel next, and the raw technical-noise tabs (Performance,
 * Dependency Map) last — per the founder's information-priority brief.
 */
const TABS: { id: Tab; label: string }[] = [
  { id: "live", label: "Live Monitor" },
  { id: "errors", label: "Error Center" },
  { id: "history", label: "Execution History" },
  { id: "audit", label: "Audit" },
  { id: "health", label: "Health Panel" },
  { id: "performance", label: "Performance" },
  { id: "dependencies", label: "Dependency Map" },
];

const BUCKET_LABEL: Record<WorkflowExecutionBucket, string> = {
  running: "Running",
  waiting: "Waiting",
  failed: "Failed",
  successful: "Successful",
  cancelled: "Cancelled",
  skipped: "Skipped",
};
const BUCKET_TONE: Record<WorkflowExecutionBucket, BadgeTone> = {
  running: "accent",
  waiting: "warning",
  failed: "danger",
  successful: "success",
  cancelled: "neutral",
  skipped: "outline",
};

interface MonitoringData {
  live: WorkflowLiveMonitorSnapshot;
  history: WorkflowExecutionSummary[];
  errors: WorkflowErrorRecordWithStatus[];
  performance: WorkflowPerformanceMetrics;
  dependencies: WorkflowDependencyMap;
  health: WorkspaceWorkflowHealthSummary;
  audit: WorkflowAuditRecord[];
}

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: MonitoringData };

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function loadAll(): Promise<LoadState> {
  const [live, history, errors, performance, dependencies, health, audit] = await Promise.all([
    getWorkflowLiveMonitorAction(),
    getWorkflowExecutionHistoryAction(),
    getWorkflowErrorsAction(),
    getWorkflowPerformanceMetricsAction(),
    getWorkflowDependencyMapAction(),
    getWorkspaceWorkflowHealthAction(),
    getWorkflowAuditLogAction(),
  ]);
  for (const result of [live, history, errors, performance, dependencies, health, audit]) {
    if (!result.success) return { status: "error", message: result.error };
  }
  return {
    status: "ready",
    data: {
      live: (live as { success: true; data: WorkflowLiveMonitorSnapshot }).data,
      history: (history as { success: true; data: WorkflowExecutionSummary[] }).data,
      errors: (errors as { success: true; data: WorkflowErrorRecordWithStatus[] }).data,
      performance: (performance as { success: true; data: WorkflowPerformanceMetrics }).data,
      dependencies: (dependencies as { success: true; data: WorkflowDependencyMap }).data,
      health: (health as { success: true; data: WorkspaceWorkflowHealthSummary }).data,
      audit: (audit as { success: true; data: WorkflowAuditRecord[] }).data,
    },
  };
}

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — the Workflow Monitoring Center.
 * Every tab renders straight from the read-only `monitoringCenterActions.ts`
 * queries, which themselves compose the real Automation History + Workflow
 * store + Validation Engine — nothing here recomputes anything. Mutations
 * (retry/clone/export/ignore/archive) all reload the full snapshot
 * afterward, keeping every tab consistent with the one real execution
 * record they just changed.
 */
export function WorkflowMonitoringCenterView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [tab, setTab] = useState<Tab>("live");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  const refresh = useCallback(() => {
    loadAll().then(setState);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRetry(executionId: string) {
    setPendingId(executionId);
    const result = await retryWorkflowExecutionAction(executionId);
    setPendingId(null);
    setToast(result.success ? { tone: "success", message: `Execution re-run — new status: ${result.data.status}.` } : { tone: "danger", message: result.error });
    if (result.success) refresh();
  }

  async function handleClone(executionId: string) {
    setPendingId(executionId);
    const result = await cloneWorkflowExecutionAction(executionId);
    setPendingId(null);
    setToast(result.success ? { tone: "success", message: `Execution cloned — new status: ${result.data.status}.` } : { tone: "danger", message: result.error });
    if (result.success) refresh();
  }

  async function handleExport(executionId: string) {
    const result = await exportWorkflowExecutionLogAction(executionId);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    const blob = new Blob([result.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${executionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleIgnore(executionId: string, actionId: string) {
    const result = await ignoreWorkflowErrorAction(executionId, actionId);
    if (result.success) refresh();
    else setToast({ tone: "danger", message: result.error });
  }

  async function handleArchive(executionId: string, actionId: string) {
    const result = await archiveWorkflowErrorAction(executionId, actionId);
    if (result.success) refresh();
    else setToast({ tone: "danger", message: result.error });
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Workflow Monitoring Center" subtitle="Live execution health across every Workflow, composed entirely from the real Automation Engine." />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState message={state.message} />;
  }

  const { data } = state;
  const bucketCounts = Object.fromEntries(TABS.length ? (Object.keys(data.live.buckets) as WorkflowExecutionBucket[]).map((bucket) => [bucket, data.live.buckets[bucket].length]) : []) as Record<WorkflowExecutionBucket, number>;
  // Real, already-computed counts surfaced on the tab labels themselves so the page leads with
  // "what needs review" (open errors, waiting+failed executions) rather than raw technical noise.
  const openErrorsCount = data.errors.filter((error) => error.acknowledgement === "open").length;
  const needsAttentionCount = data.live.buckets.waiting.length + data.live.buckets.failed.length;
  const TAB_BADGE: Partial<Record<Tab, { count: number; tone: BadgeTone }>> = {
    errors: { count: openErrorsCount, tone: "danger" },
    live: { count: needsAttentionCount, tone: "warning" },
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workflow Monitoring Center"
        subtitle="Live execution health across every Workflow, composed entirely from the real Automation Engine — no second execution model."
        breadcrumb={[{ label: "Workflows", href: "/workflows" }, { label: "Monitoring Center" }]}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabList aria-label="Workflow monitoring views">
          {TABS.map((entry) => {
            const badge = TAB_BADGE[entry.id];
            return (
              <Tab key={entry.id} value={entry.id}>
                <span className="inline-flex items-center gap-1.5">
                  {entry.label}
                  {badge && badge.count > 0 ? <Badge tone={badge.tone}>{badge.count}</Badge> : null}
                </span>
              </Tab>
            );
          })}
        </TabList>

        <TabPanel value="live" className="mt-4">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {(Object.keys(BUCKET_LABEL) as WorkflowExecutionBucket[]).map((bucket) => (
                <Card key={bucket} className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{BUCKET_LABEL[bucket]}</p>
                  <p className="mt-1 text-2xl font-semibold text-text">{bucketCounts[bucket] ?? 0}</p>
                </Card>
              ))}
            </div>

            <Card>
              <h3 className="font-serif text-lg font-semibold text-text">Scheduled Workflows</h3>
              <p className="mt-1 text-xs text-text-muted">Configuration, not a live queue — BloomOS has no background scheduler to fire these automatically yet.</p>
              {data.live.scheduled.length === 0 ? (
                <p className="mt-3 text-sm text-text-muted">No Workflow has a schedule configured.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {data.live.scheduled.map((entry) => (
                    <li key={entry.workflowId} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <Link href={`/workflows/${entry.workflowId}`} className="text-text hover:underline">
                        {entry.workflowName}
                      </Link>
                      <span className="text-text-muted">
                        {entry.frequency} at {entry.time}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <ExecutionTable executions={[...data.live.buckets.waiting, ...data.live.buckets.failed]} pendingId={pendingId} onRetry={handleRetry} onClone={handleClone} onExport={handleExport} title="Needs attention (Waiting + Failed)" />
          </div>
        </TabPanel>

        <TabPanel value="history" className="mt-4">
          <ExecutionTable executions={data.history} pendingId={pendingId} onRetry={handleRetry} onClone={handleClone} onExport={handleExport} title="Every execution" showAll />
        </TabPanel>

        <TabPanel value="errors" className="mt-4">
          <ErrorCenterTab errors={data.errors} pendingId={pendingId} onRetry={handleRetry} onIgnore={handleIgnore} onArchive={handleArchive} />
        </TabPanel>

        <TabPanel value="performance" className="mt-4">
          <PerformanceTab metrics={data.performance} />
        </TabPanel>

        <TabPanel value="dependencies" className="mt-4">
          <DependencyTab dependencyMap={data.dependencies} />
        </TabPanel>

        <TabPanel value="health" className="mt-4">
          <HealthTab health={data.health} />
        </TabPanel>

        <TabPanel value="audit" className="mt-4">
          <AuditTab records={data.audit} onExport={handleExport} />
        </TabPanel>
      </Tabs>

      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

/**
 * Label/value pair used inside the `sm:hidden` mobile card layouts below —
 * the same fields the desktop tables show, just stacked instead of packed
 * into columns that would otherwise get squeezed or horizontally scrolled
 * on a 375–390px viewport.
 */
function MobileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}

function ExecutionTable({
  executions,
  pendingId,
  onRetry,
  onClone,
  onExport,
  title,
  showAll = false,
}: {
  executions: WorkflowExecutionSummary[];
  pendingId: string | null;
  onRetry: (executionId: string) => void;
  onClone: (executionId: string) => void;
  onExport: (executionId: string) => void;
  title: string;
  showAll?: boolean;
}) {
  if (executions.length === 0) return <EmptyState title={title} description="No executions to show." />;

  const actions = (execution: WorkflowExecutionSummary) => (
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant="ghost" disabled={pendingId === execution.executionId} onClick={() => onRetry(execution.executionId)}>
        Retry
      </Button>
      <Button type="button" variant="ghost" disabled={pendingId === execution.executionId} onClick={() => onClone(execution.executionId)}>
        Clone
      </Button>
      <Button type="button" variant="ghost" onClick={() => onExport(execution.executionId)}>
        Export
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop / tablet: real table, horizontal-scroll contained. */}
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <h3 className="border-b border-border px-4 py-3 font-serif text-lg font-semibold text-text">{title}</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2">Workflow</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Trigger</th>
              <th className="px-4 py-2">Current node</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Started by</th>
              <th className="px-4 py-2">Started</th>
              <th className="px-4 py-2">Duration</th>
              {showAll ? <th className="px-4 py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {executions.map((execution) => (
              <tr key={execution.executionId}>
                <td className="px-4 py-2">
                  {execution.workflowId ? (
                    <Link href={`/workflows/${execution.workflowId}`} className="text-text hover:underline">
                      {execution.workflowName}
                    </Link>
                  ) : (
                    execution.workflowName
                  )}
                  <span className="block text-[11px] text-text-muted">v{execution.workflowVersion}</span>
                </td>
                <td className="px-4 py-2">
                  <Badge tone={BUCKET_TONE[execution.bucket]}>{BUCKET_LABEL[execution.bucket]}</Badge>
                </td>
                <td className="px-4 py-2 text-text-muted">{execution.trigger}</td>
                <td className="px-4 py-2 text-text-muted">{execution.currentNodeId ?? "—"}</td>
                <td className="px-4 py-2 text-text-muted">{execution.entity ? `${execution.entity.type}:${execution.entity.id}` : "—"}</td>
                <td className="px-4 py-2 text-text-muted">{execution.startedBy ?? "system"}</td>
                <td className="px-4 py-2 text-text-muted">{formatDateTime(execution.startedAt)}</td>
                <td className="px-4 py-2 text-text-muted">{formatDuration(execution.durationMs)}</td>
                {showAll ? <td className="px-4 py-2">{actions(execution)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: same fields, stacked as cards instead of a horizontally-scrolled sliver of the table. */}
      <div className="flex flex-col gap-3 sm:hidden">
        <h3 className="px-1 font-serif text-lg font-semibold text-text">{title}</h3>
        {executions.map((execution) => (
          <LuxuryCard key={execution.executionId} className="flex flex-col gap-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                {execution.workflowId ? (
                  <Link href={`/workflows/${execution.workflowId}`} className="text-sm font-medium text-text hover:underline">
                    {execution.workflowName}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-text">{execution.workflowName}</span>
                )}
                <span className="block text-[11px] text-text-muted">v{execution.workflowVersion}</span>
              </div>
              <Badge tone={BUCKET_TONE[execution.bucket]}>{BUCKET_LABEL[execution.bucket]}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <MobileField label="Trigger" value={execution.trigger} />
              <MobileField label="Current node" value={execution.currentNodeId ?? "—"} />
              <MobileField label="Entity" value={execution.entity ? `${execution.entity.type}:${execution.entity.id}` : "—"} />
              <MobileField label="Started by" value={execution.startedBy ?? "system"} />
              <MobileField label="Started" value={formatDateTime(execution.startedAt)} />
              <MobileField label="Duration" value={formatDuration(execution.durationMs)} />
            </dl>
            {showAll ? actions(execution) : null}
          </LuxuryCard>
        ))}
      </div>
    </div>
  );
}

function ErrorCenterTab({
  errors,
  pendingId,
  onRetry,
  onIgnore,
  onArchive,
}: {
  errors: WorkflowErrorRecordWithStatus[];
  pendingId: string | null;
  onRetry: (executionId: string) => void;
  onIgnore: (executionId: string, actionId: string) => void;
  onArchive: (executionId: string, actionId: string) => void;
}) {
  const open = errors.filter((error) => error.acknowledgement === "open");
  if (errors.length === 0) return <EmptyState title="No workflow errors" description="Every recorded execution has completed cleanly." />;

  const heading = (
    <h3 className="font-serif text-lg font-semibold text-text">
      Workflow Errors <span className="text-sm font-normal text-text-muted">({open.length} open of {errors.length})</span>
    </h3>
  );

  const actions = (error: WorkflowErrorRecordWithStatus) => (
    <div className="flex flex-wrap gap-1">
      <Button type="button" variant="ghost" disabled={pendingId === error.executionId} onClick={() => onRetry(error.executionId)}>
        Retry
      </Button>
      <Button type="button" variant="ghost" disabled={error.acknowledgement !== "open"} onClick={() => onIgnore(error.executionId, error.actionId)}>
        Ignore
      </Button>
      <Button type="button" variant="ghost" disabled={error.acknowledgement === "archived"} onClick={() => onArchive(error.executionId, error.actionId)}>
        Archive
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop / tablet: real table, horizontal-scroll contained. */}
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <div className="border-b border-border px-4 py-3">{heading}</div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2">Workflow</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Stack</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Retries</th>
              <th className="px-4 py-2">Occurred</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {errors.map((error) => (
              <tr key={`${error.executionId}:${error.actionId}`} className={error.acknowledgement !== "open" ? "opacity-50" : ""}>
                <td className="px-4 py-2 text-text">{error.workflowName}</td>
                <td className="px-4 py-2 text-text-muted">{error.actionId}</td>
                <td className="max-w-xs truncate px-4 py-2 text-text-muted" title={error.stack}>
                  {error.stack}
                </td>
                <td className="px-4 py-2 text-text-muted">{error.entity ? `${error.entity.type}:${error.entity.id}` : "—"}</td>
                <td className="px-4 py-2 text-text-muted">{error.retryCount}</td>
                <td className="px-4 py-2 text-text-muted">{formatDateTime(error.occurredAt)}</td>
                <td className="px-4 py-2">
                  <Badge tone={error.acknowledgement === "open" ? "danger" : error.acknowledgement === "ignored" ? "warning" : "neutral"}>{error.acknowledgement}</Badge>
                </td>
                <td className="px-4 py-2">{actions(error)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: same fields, stacked as cards instead of a horizontally-scrolled sliver of the table. */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="px-1">{heading}</div>
        {errors.map((error) => (
          <LuxuryCard
            key={`${error.executionId}:${error.actionId}`}
            className={`flex flex-col gap-3 text-xs ${error.acknowledgement !== "open" ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-text">{error.workflowName}</span>
              <Badge tone={error.acknowledgement === "open" ? "danger" : error.acknowledgement === "ignored" ? "warning" : "neutral"}>{error.acknowledgement}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <MobileField label="Action" value={error.actionId} />
              <MobileField label="Entity" value={error.entity ? `${error.entity.type}:${error.entity.id}` : "—"} />
              <MobileField label="Retries" value={error.retryCount} />
              <MobileField label="Occurred" value={formatDateTime(error.occurredAt)} />
            </dl>
            <MobileField label="Stack" value={<span className="line-clamp-3 break-words">{error.stack}</span>} />
            {actions(error)}
          </LuxuryCard>
        ))}
      </div>
    </div>
  );
}

function PerformanceTab({ metrics }: { metrics: WorkflowPerformanceMetrics }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Average execution time" value={metrics.averageExecutionDurationMs !== null ? formatDuration(metrics.averageExecutionDurationMs) : "—"} icon={AutomationIcon} />
        <KpiCard label="Success rate" value={metrics.successRate !== null ? `${metrics.successRate}%` : "—"} icon={AnalyticsIcon} />
        <KpiCard label="Average wait time" value={metrics.averageWaitTimeMs !== null ? formatDuration(metrics.averageWaitTimeMs) : "—"} helper={`${metrics.failedExecutionCount} failed executions`} icon={AutomationIcon} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RankingCard title="Slowest workflows" rows={metrics.slowestWorkflows.map((entry) => ({ label: entry.workflowName, value: formatDuration(entry.averageDurationMs) }))} />
        <RankingCard title="Fastest workflows" rows={metrics.fastestWorkflows.map((entry) => ({ label: entry.workflowName, value: formatDuration(entry.averageDurationMs) }))} />
        <RankingCard title="Most executed workflows" rows={metrics.mostExecutedWorkflows.map((entry) => ({ label: entry.workflowName, value: `${entry.executionCount}×` }))} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FrequencyCard title="Trigger frequency" entries={metrics.triggerFrequency as Record<string, number>} />
        <FrequencyCard title="Action frequency" entries={metrics.actionExecutionFrequency} />
        <FrequencyCard title="Node frequency" entries={metrics.nodeExecutionFrequency} />
      </div>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <Card>
      <h3 className="font-serif text-base font-semibold text-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No data yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {rows.map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-text">{row.label}</span>
              <span className="shrink-0 text-text-muted">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FrequencyCard({ title, entries }: { title: string; entries: Record<string, number> }) {
  const rows = Object.entries(entries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <Card>
      <h3 className="font-serif text-base font-semibold text-text">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No data yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {rows.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-text-muted">{key}</span>
              <span className="shrink-0 text-text">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DependencyTab({ dependencyMap }: { dependencyMap: WorkflowDependencyMap }) {
  return (
    <div className="flex flex-col gap-4">
      {dependencyMap.circularChains.length > 0 ? (
        <Card className="border-danger/40">
          <h3 className="font-serif text-base font-semibold text-danger">Circular references detected</h3>
          <ul className="mt-2 space-y-1 text-sm text-text-muted">
            {dependencyMap.circularChains.map((chain, index) => (
              <li key={index}>{chain.join(" → ")} → {chain[0]}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <h3 className="font-serif text-base font-semibold text-text">Workflows triggering workflows</h3>
        {dependencyMap.workflowsTriggeringWorkflows.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No workflow-to-workflow trigger chains detected yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {dependencyMap.workflowsTriggeringWorkflows.map((edge, index) => (
              <li key={index} className="py-2">
                <span className="text-text">{edge.sourceWorkflowName}</span> produces <Badge tone="accent">{edge.producedTrigger}</Badge> → {edge.targetWorkflowIds.length} listening workflow(s)
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-base font-semibold text-text">Trigger graph</h3>
        <ul className="mt-2 divide-y divide-border text-sm">
          {Object.entries(dependencyMap.triggerGraph).map(([trigger, workflowIds]) => (
            <li key={trigger} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-text-muted">{trigger}</span>
              <span className="text-text">{workflowIds?.length ?? 0} workflow(s)</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function HealthTab({ health }: { health: WorkspaceWorkflowHealthSummary }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label="Average health score" value={health.averageScore !== null ? `${health.averageScore}/100` : "—"} icon={AnalyticsIcon} />
        <KpiCard label="Total findings" value={String(health.totalFindings)} icon={AutomationIcon} />
      </div>
      {health.reports.length === 0 ? (
        <EmptyState title="No workflows yet" description="Health reports appear once at least one Workflow exists." />
      ) : (
        <div className="flex flex-col gap-3">
          {health.reports.map((report) => (
            <Card key={report.workflowId}>
              <div className="flex items-center justify-between gap-2">
                <Link href={`/workflows/${report.workflowId}`} className="font-serif text-base font-semibold text-text hover:underline">
                  {report.workflowName}
                </Link>
                <Badge tone={report.score >= 80 ? "success" : report.score >= 50 ? "warning" : "danger"}>{report.score}/100</Badge>
              </div>
              {report.structuralIssues.length === 0 && report.findings.length === 0 ? (
                <p className="mt-2 text-sm text-text-muted">No issues detected.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {report.structuralIssues.map((issue, index) => (
                    <li key={`structural-${index}`} className="text-danger">
                      {issue.message}
                    </li>
                  ))}
                  {report.findings.map((finding, index) => (
                    <li key={`finding-${index}`} className="text-text-muted">
                      {finding.message}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTab({ records, onExport }: { records: WorkflowAuditRecord[]; onExport: (executionId: string) => void }) {
  if (records.length === 0) return <EmptyState title="No audit records yet" description="Every workflow execution produces an immutable audit record here." />;

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop / tablet: real table, horizontal-scroll contained. */}
      <Card className="hidden overflow-x-auto p-0 sm:block">
        <h3 className="border-b border-border px-4 py-3 font-serif text-lg font-semibold text-text">Workflow Audit Log</h3>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-2">Workflow</th>
              <th className="px-4 py-2">Version</th>
              <th className="px-4 py-2">Node path</th>
              <th className="px-4 py-2">Duration</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Export</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((record) => (
              <tr key={record.executionId}>
                <td className="px-4 py-2 text-text">{record.workflowName}</td>
                <td className="px-4 py-2 text-text-muted">{record.versionExecuted}</td>
                <td className="max-w-xs truncate px-4 py-2 text-text-muted" title={record.nodePath.join(" → ")}>
                  {record.nodePath.length > 0 ? record.nodePath.join(" → ") : "—"}
                </td>
                <td className="px-4 py-2 text-text-muted">{formatDuration(record.durationMs)}</td>
                <td className="px-4 py-2 text-text-muted">{record.actor}</td>
                <td className="px-4 py-2 text-text-muted">{formatDateTime(record.timestamp)}</td>
                <td className="px-4 py-2">
                  <Button type="button" variant="ghost" onClick={() => onExport(record.executionId)}>
                    Export
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: same fields, stacked as cards instead of a horizontally-scrolled sliver of the table. */}
      <div className="flex flex-col gap-3 sm:hidden">
        <h3 className="px-1 font-serif text-lg font-semibold text-text">Workflow Audit Log</h3>
        {records.map((record) => (
          <LuxuryCard key={record.executionId} className="flex flex-col gap-3 text-xs">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-text">{record.workflowName}</span>
              <span className="text-text-muted">v{record.versionExecuted}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              <MobileField label="Duration" value={formatDuration(record.durationMs)} />
              <MobileField label="Actor" value={record.actor} />
              <MobileField label="Timestamp" value={formatDateTime(record.timestamp)} />
            </dl>
            <MobileField
              label="Node path"
              value={<span className="line-clamp-3 break-words">{record.nodePath.length > 0 ? record.nodePath.join(" → ") : "—"}</span>}
            />
            <Button type="button" variant="ghost" onClick={() => onExport(record.executionId)}>
              Export
            </Button>
          </LuxuryCard>
        ))}
      </div>
    </div>
  );
}

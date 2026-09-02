"use client";

import { useEffect, useRef, useState } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { AutomationIcon, CheckIcon, TaskIcon, NotificationsIcon } from "@/components/ui/icons";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getAutomationDashboardData, type AutomationDashboardData } from "@/modules/automation/getAutomationDashboardData";
import { approveAutomationExecution } from "@/modules/automation/approveAutomationExecution";
import { rejectAutomationExecution } from "@/modules/automation/rejectAutomationExecution";
import type { AutomationExecution, AutomationExecutionStatus } from "@/types/automation";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AutomationDashboardData };

const STATUS_LABEL: Record<AutomationExecutionStatus, string> = {
  success: "Success",
  failure: "Failure",
  partial_failure: "Partial failure",
  pending_approval: "Pending approval",
  skipped_conditions_not_met: "Skipped — conditions not met",
  rejected: "Rejected",
};

const STATUS_TONE: Record<AutomationExecutionStatus, BadgeTone> = {
  success: "success",
  failure: "danger",
  partial_failure: "warning",
  pending_approval: "warning",
  skipped_conditions_not_met: "outline",
  rejected: "danger",
};

const TRIGGER_LABEL: Record<string, string> = {
  "proposal.accepted": "Proposal Accepted",
  "proposal.rejected": "Proposal Rejected",
  "invoice.overdue": "Invoice Overdue",
  "invoice.paid": "Invoice Paid",
  "contract.signed": "Contract Signed",
  "event.created": "Event Created",
  "event.updated": "Event Updated",
  "event.completed": "Event Completed",
  "daily_brief.generated": "Daily Brief Generated",
  "crm_recommendation.accepted": "CRM Recommendation Accepted",
  "finance_recommendation.accepted": "Finance Recommendation Accepted",
  "memory.created": "Memory Created",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function loadDashboard(): Promise<LoadState> {
  const result = await getAutomationDashboardData();
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

/**
 * The Step 9 Automation Dashboard — the one place a human watches the
 * Execution Engine work and acts on what it's waiting for. Every section
 * reads from `getAutomationDashboardData()` (one aggregate, computed
 * server-side), the same "one call, no hand-maintained UI array" shape
 * `BloomAIOverviewView` established. Approve/Reject never call an Action
 * directly — both route through their own dedicated Server Actions, which
 * themselves only ever call `executeAutomation()`/the Automation Manager,
 * keeping this component a pure "no UI may execute actions directly"
 * consumer (Step 7's own rule).
 *
 * Phase 09C — visual-only pass: the four Automation Health figures that
 * used to live in their own bespoke card now sit in the top KpiCard row
 * (a calm "is the Engine healthy" read), and the remaining sections are
 * grouped by what a human actually needs to do with them — what's waiting
 * on a decision first, what's active in the Engine next, then the quieter
 * activity log last. No data shape, handler, or computed value changed.
 */
export function AutomationDashboardView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const approvalsRef = useRef<HTMLDivElement>(null);
  const executionsRef = useRef<HTMLDivElement>(null);

  function refresh() {
    setState({ status: "loading" });
    loadDashboard().then(setState);
  }

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 11 — "Add: Automation Center, Pending Approvals, Recent Executions
  // through the existing platform." Self-registers into the Command
  // Palette registry the same way `BloomAISkillPicker` does — that global
  // shell isn't mounted anywhere yet, so this is "found there for free"
  // once it is, exactly matching that component's own precedent rather
  // than inventing a second pattern.
  useEffect(() => {
    registerCommand({
      id: "automation-center",
      label: "Automation Center",
      group: "Automation",
      keywords: ["automation", "trigger", "action"],
      run: () => {
        headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        headingRef.current?.focus();
      },
    });
    registerCommand({
      id: "pending-approvals",
      label: "Pending Approvals",
      group: "Automation",
      keywords: ["automation", "approve", "approval"],
      run: () => approvalsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
    });
    registerCommand({
      id: "recent-executions",
      label: "Recent Executions",
      group: "Automation",
      keywords: ["automation", "history", "log"],
      run: () => executionsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
    });
    return () => {
      unregisterCommand("automation-center");
      unregisterCommand("pending-approvals");
      unregisterCommand("recent-executions");
    };
  }, []);

  async function handleApprove(executionId: string) {
    setPendingActionId(executionId);
    const result = await approveAutomationExecution(executionId);
    setPendingActionId(null);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setToast({ tone: "success", message: `Automation approved — ${result.data.status === "success" ? "ran successfully" : STATUS_LABEL[result.data.status].toLowerCase()}.` });
    refresh();
  }

  async function handleReject(executionId: string) {
    setPendingActionId(executionId);
    const result = await rejectAutomationExecution(executionId);
    setPendingActionId(null);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setToast({ tone: "success", message: "Automation rejected." });
    refresh();
  }

  return (
    <div>
      <div ref={headingRef} tabIndex={-1} className="focus:outline-none">
        <PageHeader
          title="Automation Center"
          subtitle="The single execution path for every deterministic business action in BloomOS. Automations run only after an explicit trigger and, when required, a human's own approval — Bloom AI may suggest an automation, but it never executes one."
          icon={AutomationIcon}
          actions={
            <Button type="button" variant="secondary" onClick={refresh} disabled={state.status === "loading"}>
              Refresh
            </Button>
          }
        />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {state.status === "error" ? <ErrorState message={state.message} onRetry={refresh} /> : null}

        {state.status === "ready" ? (
          <div className="space-y-8">
            <EngineHealthKpiRow data={state.data} />

            <section aria-labelledby="automation-attention-heading">
              <h2 id="automation-attention-heading" className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Needs Attention
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div ref={approvalsRef}>
                  <PendingApprovalsCard
                    data={state.data}
                    pendingActionId={pendingActionId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </div>
                <FailureSummaryCard data={state.data} />
              </div>
            </section>

            <section aria-labelledby="automation-active-heading">
              <h2 id="automation-active-heading" className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Active in the Engine
              </h2>
              <div className="space-y-4">
                <RegisteredAutomationsCard data={state.data} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RegisteredTriggersCard data={state.data} />
                  <RegisteredActionsCard data={state.data} />
                </div>
              </div>
            </section>

            <section aria-labelledby="automation-activity-heading">
              <h2 id="automation-activity-heading" className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Activity Log
              </h2>
              <div className="space-y-4">
                <div ref={executionsRef}>
                  <RecentExecutionsCard executions={state.data.recentExecutions} />
                </div>
                <ExecutionStatisticsCard data={state.data} />
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

function EngineHealthKpiRow({ data }: { data: AutomationDashboardData }) {
  const { stats } = data;
  const unlisteneredTriggers = data.triggerSummary.filter((trigger) => trigger.listenerCount === 0).length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        icon={CheckIcon}
        label="Success Rate"
        value={stats.successRatePercent === null ? "—" : `${stats.successRatePercent}%`}
        helper="Over the recent executions shown below"
      />
      <KpiCard icon={AutomationIcon} label="Registered Automations" value={String(data.registeredAutomations.length)} />
      <KpiCard icon={TaskIcon} label="Registered Actions" value={String(data.registeredActions.length)} />
      <KpiCard
        icon={NotificationsIcon}
        label="Triggers With No Listener"
        value={String(unlisteneredTriggers)}
      />
    </div>
  );
}

function PendingApprovalsCard({
  data,
  pendingActionId,
  onApprove,
  onReject,
}: {
  data: AutomationDashboardData;
  pendingActionId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <LuxuryCard tone={data.pendingApprovals.length > 0 ? "tint" : "surface"} className="h-full">
      <h3 id="automation-approvals-heading" className="font-serif text-[17px] font-semibold text-text">
        Pending Approvals
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Automations waiting on an explicit human decision before their actions run. Approving re-runs the automation
        through the Execution Engine; rejecting stops it here.
      </p>
      {data.pendingApprovals.length === 0 ? (
        <EmptyState
          illustration="generic"
          title="Nothing is waiting on approval"
          description="Every Automation that needed a human decision has already been resolved."
        />
      ) : (
        <ul className="mt-3 divide-y divide-border" aria-labelledby="automation-approvals-heading">
          {data.pendingApprovals.map((execution) => {
            const canAct = data.approvableExecutionIds.includes(execution.id);
            const busy = pendingActionId === execution.id;
            return (
              <li key={execution.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-text">{execution.automationName}</p>
                  <p className="text-xs text-text-muted">
                    {TRIGGER_LABEL[execution.trigger] ?? execution.trigger} · {formatDateTime(execution.startedAt)}
                  </p>
                  {!canAct ? <p className="mt-0.5 text-xs text-text-muted">Your role can&apos;t grant this approval.</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-success/40 text-success hover:bg-success/10 active:bg-success/20"
                    disabled={!canAct || busy}
                    onClick={() => onApprove(execution.id)}
                  >
                    {busy ? "Approving…" : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 active:bg-danger/20"
                    disabled={!canAct || busy}
                    onClick={() => onReject(execution.id)}
                  >
                    {busy ? "…" : "Reject"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </LuxuryCard>
  );
}

function RecentExecutionsCard({ executions }: { executions: AutomationExecution[] }) {
  return (
    <LuxuryCard>
      <h3 id="automation-executions-heading" className="font-serif text-[17px] font-semibold text-text">
        Recent Executions
      </h3>
      <p className="mt-1 text-sm text-text-muted">Every Automation attempt, in order — including skipped and still-pending ones, never just the successes.</p>
      {executions.length === 0 ? (
        <EmptyState illustration="generic" title="No Automation has run yet" description="Once a trigger fires in this Workspace, its attempts will appear here in order." />
      ) : (
        <ul className="mt-3 divide-y divide-border" aria-labelledby="automation-executions-heading">
          {executions.map((execution) => (
            <li key={execution.id} className="flex flex-col gap-2 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div>
                <span className="font-medium text-text">{execution.automationName}</span>
                <p className="text-xs text-text-muted">
                  {TRIGGER_LABEL[execution.trigger] ?? execution.trigger} · {formatDateTime(execution.startedAt)} · {execution.durationMs}ms ·{" "}
                  {execution.actionResults.length} action{execution.actionResults.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={STATUS_TONE[execution.status]}>{STATUS_LABEL[execution.status]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function ExecutionStatisticsCard({ data }: { data: AutomationDashboardData }) {
  const { stats } = data;
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Execution Statistics</h3>
      <p className="mt-1 text-sm text-text-muted">{stats.totalExecutions} execution{stats.totalExecutions === 1 ? "" : "s"} · {stats.averageDurationMs}ms average duration</p>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {(Object.keys(stats.byStatus) as AutomationExecutionStatus[]).map((status) => (
          <li key={status} className="flex items-center justify-between gap-2">
            <span className="text-text-muted">{STATUS_LABEL[status]}</span>
            <span className="tabular-nums text-text">{stats.byStatus[status]}</span>
          </li>
        ))}
      </ul>
    </LuxuryCard>
  );
}

function RegisteredTriggersCard({ data }: { data: AutomationDashboardData }) {
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Registered Triggers</h3>
      <p className="mt-1 text-sm text-text-muted">Every trigger type the Engine knows about, and how many active Automations listen for it.</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {data.triggerSummary.map((trigger) => (
          <li key={trigger.type} className="flex items-center justify-between gap-2">
            <span className="text-text">{TRIGGER_LABEL[trigger.type] ?? trigger.type}</span>
            <Badge tone={trigger.listenerCount > 0 ? "accent" : "outline"}>
              {trigger.listenerCount} listener{trigger.listenerCount === 1 ? "" : "s"}
            </Badge>
          </li>
        ))}
      </ul>
    </LuxuryCard>
  );
}

function RegisteredActionsCard({ data }: { data: AutomationDashboardData }) {
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Registered Actions</h3>
      <p className="mt-1 text-sm text-text-muted">Every typed Action available to an Automation Definition, from the Action Registry.</p>
      <ul className="mt-3 space-y-2">
        {data.registeredActions.map((action) => (
          <li key={action.id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-text">{action.name}</span>
              <Badge tone="neutral">{action.category}</Badge>
            </div>
            <p className="text-xs text-text-muted">{action.description}</p>
          </li>
        ))}
      </ul>
    </LuxuryCard>
  );
}

function FailureSummaryCard({ data }: { data: AutomationDashboardData }) {
  return (
    <LuxuryCard tone={data.failureSummary.length > 0 ? "tint" : "surface"} className="h-full">
      <h3 id="automation-failures-heading" className="font-serif text-[17px] font-semibold text-text">
        Failure Summary
      </h3>
      <p className="mt-1 text-sm text-text-muted">Automations with at least one failed or partially-failed run in the recent window shown above.</p>
      {data.failureSummary.length === 0 ? (
        <EmptyState illustration="generic" title="No failures" description="No Automation has failed in the recent execution window." />
      ) : (
        <ul className="mt-3 space-y-2" aria-labelledby="automation-failures-heading">
          {data.failureSummary.map((entry) => (
            <li key={entry.automationId} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="text-text">{entry.automationName}</span>
              <span className="text-xs text-text-muted">
                {entry.failureCount} failure{entry.failureCount === 1 ? "" : "s"}
                {entry.lastFailureAt ? ` · last ${formatDateTime(entry.lastFailureAt)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

function RegisteredAutomationsCard({ data }: { data: AutomationDashboardData }) {
  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Registered Automations</h3>
      <p className="mt-1 text-sm text-text-muted">Every Automation Definition visible to you in this Workspace.</p>
      {data.registeredAutomations.length === 0 ? (
        <EmptyState illustration="generic" title="No Automation is visible yet" description="Automations gated behind a permission, role, or feature flag you don't have won't appear here." />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {data.registeredAutomations.map((automation) => (
            <li key={automation.id} className="py-2.5 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <span className="font-medium text-text">{automation.name}</span>
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">{TRIGGER_LABEL[automation.trigger] ?? automation.trigger}</Badge>
                  <Badge tone={automation.status === "active" ? "accent" : "outline"}>{automation.status === "active" ? "Active" : "Disabled"}</Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-text-muted">{automation.description}</p>
            </li>
          ))}
        </ul>
      )}
    </LuxuryCard>
  );
}

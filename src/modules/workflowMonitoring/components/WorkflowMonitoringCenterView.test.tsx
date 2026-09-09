import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowMonitoringCenterView } from "@/modules/workflowMonitoring/components/WorkflowMonitoringCenterView";
import type { WorkflowErrorRecordWithStatus } from "@/modules/workflowMonitoring/monitoringCenterActions";
import type { WorkflowLiveMonitorSnapshot } from "@/core/workflowMonitoring/liveMonitor";
import type {
  WorkflowExecutionSummary,
  WorkflowPerformanceMetrics,
  WorkflowDependencyMap,
  WorkspaceWorkflowHealthSummary,
  WorkflowDurationRanking,
  WorkflowTriggerEdge,
  WorkflowHealthReport,
  WorkflowAuditRecord,
} from "@/types/workflowMonitoring";

vi.mock("@/modules/workflowMonitoring/monitoringCenterActions", () => ({
  getWorkflowLiveMonitorAction: vi.fn(),
  getWorkflowExecutionHistoryAction: vi.fn(),
  getWorkflowErrorsAction: vi.fn(),
  getWorkflowPerformanceMetricsAction: vi.fn(),
  getWorkflowDependencyMapAction: vi.fn(),
  getWorkspaceWorkflowHealthAction: vi.fn(),
  getWorkflowAuditLogAction: vi.fn(),
  retryWorkflowExecutionAction: vi.fn(),
  cloneWorkflowExecutionAction: vi.fn(),
  exportWorkflowExecutionLogAction: vi.fn(),
  ignoreWorkflowErrorAction: vi.fn(),
  archiveWorkflowErrorAction: vi.fn(),
}));

import {
  getWorkflowLiveMonitorAction,
  getWorkflowExecutionHistoryAction,
  getWorkflowErrorsAction,
  getWorkflowPerformanceMetricsAction,
  getWorkflowDependencyMapAction,
  getWorkspaceWorkflowHealthAction,
  getWorkflowAuditLogAction,
  retryWorkflowExecutionAction,
  ignoreWorkflowErrorAction,
  archiveWorkflowErrorAction,
  cloneWorkflowExecutionAction,
  exportWorkflowExecutionLogAction,
} from "@/modules/workflowMonitoring/monitoringCenterActions";

function makeExecutionSummary(overrides: Partial<WorkflowExecutionSummary> = {}): WorkflowExecutionSummary {
  return {
    executionId: "exec_1",
    workflowId: "wf_1",
    workflowName: "Notify on Overdue Invoice",
    workflowVersion: "v1",
    bucket: "waiting",
    status: "pending_approval",
    trigger: "invoice.overdue",
    executionPath: [],
    currentNodeId: null,
    entity: null,
    startedBy: null,
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: null,
    durationMs: 120,
    actionResults: [],
    ...overrides,
  };
}

function makeErrorRecord(overrides: Partial<WorkflowErrorRecordWithStatus> = {}): WorkflowErrorRecordWithStatus {
  return {
    executionId: "exec_err_1",
    workflowId: "wf_1",
    workflowName: "Sync Finance Report",
    actionId: "action_1",
    stack: "Error: something failed",
    entity: null,
    retryCount: 0,
    occurredAt: "2026-01-02T00:00:00.000Z",
    acknowledgement: "open",
    ...overrides,
  };
}

function makeLiveSnapshot(overrides: Partial<WorkflowLiveMonitorSnapshot> = {}): WorkflowLiveMonitorSnapshot {
  return {
    buckets: { running: [], waiting: [], failed: [], successful: [], cancelled: [], skipped: [] },
    scheduled: [],
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePerformance(): WorkflowPerformanceMetrics {
  return {
    averageExecutionDurationMs: null,
    slowestWorkflows: [],
    fastestWorkflows: [],
    mostExecutedWorkflows: [],
    failedExecutionCount: 0,
    successRate: null,
    averageWaitTimeMs: null,
    nodeExecutionFrequency: {},
    actionExecutionFrequency: {},
    triggerFrequency: {},
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeDependencies(): WorkflowDependencyMap {
  return { triggerGraph: {}, actionGraph: {}, workflowsTriggeringWorkflows: [], circularChains: [], evaluatedAt: "2026-01-01T00:00:00.000Z" };
}

function makeHealth(): WorkspaceWorkflowHealthSummary {
  return { reports: [], averageScore: null, totalFindings: 0, evaluatedAt: "2026-01-01T00:00:00.000Z" };
}

function makeDurationRanking(overrides: Partial<WorkflowDurationRanking> = {}): WorkflowDurationRanking {
  return { workflowId: "wf_rank_1", workflowName: "Ranked Workflow", averageDurationMs: 500, ...overrides };
}

function makeTriggerEdge(overrides: Partial<WorkflowTriggerEdge> = {}): WorkflowTriggerEdge {
  return { sourceWorkflowId: "wf_src_1", sourceWorkflowName: "Source Workflow", producedTrigger: "invoice.paid", targetWorkflowIds: ["wf_target_1", "wf_target_2"], ...overrides };
}

function makeHealthReport(overrides: Partial<WorkflowHealthReport> = {}): WorkflowHealthReport {
  return {
    workflowId: "wf_health_1",
    workflowName: "Healthy Workflow",
    status: "published",
    structuralIssues: [],
    findings: [],
    score: 90,
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAuditRecord(overrides: Partial<WorkflowAuditRecord> = {}): WorkflowAuditRecord {
  return {
    executionId: "audit_exec_1",
    workflowId: "wf_audit_1",
    workflowName: "Audited Workflow",
    versionExecuted: "1",
    inputs: {},
    outputs: [],
    durationMs: 250,
    nodePath: ["trigger_node", "action_node"],
    actor: "Amoré Bloom Owner",
    timestamp: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getWorkflowLiveMonitorAction).mockResolvedValue({ success: true, data: makeLiveSnapshot() });
  vi.mocked(getWorkflowExecutionHistoryAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(getWorkflowErrorsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(getWorkflowPerformanceMetricsAction).mockResolvedValue({ success: true, data: makePerformance() });
  vi.mocked(getWorkflowDependencyMapAction).mockResolvedValue({ success: true, data: makeDependencies() });
  vi.mocked(getWorkspaceWorkflowHealthAction).mockResolvedValue({ success: true, data: makeHealth() });
  vi.mocked(getWorkflowAuditLogAction).mockResolvedValue({ success: true, data: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("WorkflowMonitoringCenterView", () => {
  it("shows the loading state before monitoring data resolves", () => {
    vi.mocked(getWorkflowLiveMonitorAction).mockReturnValue(new Promise(() => {}));

    const { container } = render(<WorkflowMonitoringCenterView />);

    expect(container.querySelectorAll(".luxury-shimmer").length).toBeGreaterThan(0);
  });

  it("shows an error state with no retry action (current production has no onRetry)", async () => {
    vi.mocked(getWorkflowLiveMonitorAction).mockResolvedValue({ success: false, error: "Could not load the Workflow Monitoring Center." });

    render(<WorkflowMonitoringCenterView />);

    expect(await screen.findByText("Could not load the Workflow Monitoring Center.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("renders the Live Monitor's six relocated bucket counts and both VM03 tab-count badges", async () => {
    vi.mocked(getWorkflowLiveMonitorAction).mockResolvedValue({
      success: true,
      data: makeLiveSnapshot({
        buckets: {
          running: [makeExecutionSummary({ executionId: "e_run_1", bucket: "running" })],
          waiting: [makeExecutionSummary({ executionId: "e_wait_1", bucket: "waiting" }), makeExecutionSummary({ executionId: "e_wait_2", bucket: "waiting" })],
          failed: [
            makeExecutionSummary({ executionId: "e_fail_1", bucket: "failed" }),
            makeExecutionSummary({ executionId: "e_fail_2", bucket: "failed" }),
            makeExecutionSummary({ executionId: "e_fail_3", bucket: "failed" }),
          ],
          successful: Array.from({ length: 4 }, (_, i) => makeExecutionSummary({ executionId: `e_success_${i}`, bucket: "successful" })),
          cancelled: Array.from({ length: 5 }, (_, i) => makeExecutionSummary({ executionId: `e_cancel_${i}`, bucket: "cancelled" })),
          skipped: Array.from({ length: 6 }, (_, i) => makeExecutionSummary({ executionId: `e_skip_${i}`, bucket: "skipped" })),
        },
      }),
    });
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [makeErrorRecord({ executionId: "err_1", actionId: "a1", acknowledgement: "open" }), makeErrorRecord({ executionId: "err_2", actionId: "a2", acknowledgement: "open" })],
    });

    render(<WorkflowMonitoringCenterView />);
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).getByText("1")).toBeInTheDocument();
    expect(within(panel).getByText("2")).toBeInTheDocument();
    expect(within(panel).getByText("3")).toBeInTheDocument();
    expect(within(panel).getByText("4")).toBeInTheDocument();
    expect(within(panel).getByText("5")).toBeInTheDocument();
    expect(within(panel).getByText("6")).toBeInTheDocument();

    const liveTab = screen.getByRole("tab", { name: /Live Monitor/ });
    expect(within(liveTab).getByText("5")).toBeInTheDocument();
    const errorsTab = screen.getByRole("tab", { name: /Error Center/ });
    expect(within(errorsTab).getByText("2")).toBeInTheDocument();
  });

  it("switches tabs, unmounting the prior panel and mounting the next one", async () => {
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [makeErrorRecord({ workflowName: "Sync Finance Report" })],
    });
    vi.mocked(getWorkflowExecutionHistoryAction).mockResolvedValue({
      success: true,
      data: [makeExecutionSummary({ executionId: "hist_1", workflowName: "Generate Proposal Document" })],
    });

    render(<WorkflowMonitoringCenterView />);

    const liveTab = await screen.findByRole("tab", { name: /Live Monitor/ });
    expect(liveTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Scheduled Workflows" })).toBeInTheDocument();

    const errorsTab = screen.getByRole("tab", { name: /Error Center/ });
    await userEvent.click(errorsTab);
    expect(errorsTab).toHaveAttribute("aria-selected", "true");
    // "Sync Finance Report" renders twice — once in the desktop table, once in the duplicated mobile card (see test 6).
    expect((await screen.findAllByText("Sync Finance Report")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Scheduled Workflows" })).not.toBeInTheDocument();

    const historyTab = screen.getByRole("tab", { name: "Execution History" });
    await userEvent.click(historyTab);
    expect(historyTab).toHaveAttribute("aria-selected", "true");
    expect((await screen.findAllByText("Generate Proposal Document")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Sync Finance Report").length).toBe(0);
  });

  it("renders execution bucket badges and error acknowledgement badges with correct semantic text", async () => {
    vi.mocked(getWorkflowLiveMonitorAction).mockResolvedValue({
      success: true,
      data: makeLiveSnapshot({
        buckets: {
          running: [],
          waiting: [makeExecutionSummary({ executionId: "e_wait", bucket: "waiting", workflowName: "Waiting Workflow" })],
          failed: [makeExecutionSummary({ executionId: "e_fail", bucket: "failed", workflowName: "Failed Workflow" })],
          successful: [],
          cancelled: [],
          skipped: [],
        },
      }),
    });
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [
        makeErrorRecord({ executionId: "err_open", actionId: "a1", workflowName: "Open Error Workflow", acknowledgement: "open" }),
        makeErrorRecord({ executionId: "err_ignored", actionId: "a2", workflowName: "Ignored Error Workflow", acknowledgement: "ignored" }),
        makeErrorRecord({ executionId: "err_archived", actionId: "a3", workflowName: "Archived Error Workflow", acknowledgement: "archived" }),
      ],
    });

    render(<WorkflowMonitoringCenterView />);
    const livePanel = await screen.findByRole("tabpanel");
    const liveTable = within(livePanel).getByRole("table");
    expect(within(liveTable).getByText("Waiting")).toBeInTheDocument();
    expect(within(liveTable).getByText("Failed")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Error Center/ }));
    const errorsPanel = await screen.findByRole("tabpanel");
    const errorsTable = within(errorsPanel).getByRole("table");
    expect(within(errorsTable).getByText("open")).toBeInTheDocument();
    expect(within(errorsTable).getByText("ignored")).toBeInTheDocument();
    expect(within(errorsTable).getByText("archived")).toBeInTheDocument();
  });

  it("renders the same execution both in the desktop table and as a duplicated mobile card", async () => {
    vi.mocked(getWorkflowLiveMonitorAction).mockResolvedValue({
      success: true,
      data: makeLiveSnapshot({
        buckets: {
          running: [],
          waiting: [makeExecutionSummary({ executionId: "e_dual", bucket: "waiting", workflowName: "Sunset Wedding Reminder Workflow" })],
          failed: [],
          successful: [],
          cancelled: [],
          skipped: [],
        },
      }),
    });

    render(<WorkflowMonitoringCenterView />);
    const panel = await screen.findByRole("tabpanel");

    const table = within(panel).getByRole("table");
    expect(within(table).getByText("Sunset Wedding Reminder Workflow")).toBeInTheDocument();

    expect(screen.getAllByText("Sunset Wedding Reminder Workflow").length).toBe(2);
  });

  it("wires Retry to retryWorkflowExecutionAction and shows the success toast", async () => {
    // Retry/Clone/Export only render with `showAll` — production only passes that on the
    // Execution History tab's own ExecutionTable, not the Live Monitor's read-only "Needs
    // attention" table (no `showAll` there). Switching tabs is required to reach a Retry button.
    vi.mocked(getWorkflowExecutionHistoryAction).mockResolvedValue({
      success: true,
      data: [makeExecutionSummary({ executionId: "e_retry", bucket: "waiting", workflowName: "Retryable Workflow" })],
    });
    // retryWorkflowExecutionAction resolves a real AutomationExecution (not a WorkflowExecutionSummary) —
    // the component only reads its `status` field for the success toast.
    vi.mocked(retryWorkflowExecutionAction).mockResolvedValue({
      success: true,
      data: {
        id: "e_retry",
        workspaceId: "ws_1",
        automationId: "automation_1",
        automationName: "Retryable Workflow",
        automationVersion: "v1",
        trigger: "invoice.overdue",
        triggerFacts: {},
        conditionsPassed: true,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "success",
        durationMs: 120,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Execution History" }));
    // "Retryable Workflow" renders twice — once in the desktop table, once in the duplicated mobile card.
    await screen.findAllByText("Retryable Workflow");

    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    await userEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(retryWorkflowExecutionAction).toHaveBeenCalledWith("e_retry");
    });
    expect(await screen.findByText("Execution re-run — new status: success.")).toBeInTheDocument();
  });

  it("renders the Performance tab's KPI values, populated rankings, empty rankings, and populated frequency", async () => {
    vi.mocked(getWorkflowPerformanceMetricsAction).mockResolvedValue({
      success: true,
      data: {
        averageExecutionDurationMs: 2500,
        slowestWorkflows: [makeDurationRanking({ workflowId: "wf_slow", workflowName: "Slow Workflow", averageDurationMs: 9000 })],
        fastestWorkflows: [makeDurationRanking({ workflowId: "wf_fast", workflowName: "Fast Workflow", averageDurationMs: 50 })],
        mostExecutedWorkflows: [],
        failedExecutionCount: 3,
        successRate: 92,
        averageWaitTimeMs: 1500,
        nodeExecutionFrequency: {},
        actionExecutionFrequency: {},
        triggerFrequency: { "invoice.paid": 12 },
        evaluatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Performance" }));
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).getByText("2.5s")).toBeInTheDocument();
    expect(within(panel).getByText("92%")).toBeInTheDocument();
    expect(within(panel).getByText("1.5s")).toBeInTheDocument();
    expect(within(panel).getByText("3 failed executions")).toBeInTheDocument();
    expect(within(panel).getByText("Slow Workflow")).toBeInTheDocument();
    expect(within(panel).getByText("Fast Workflow")).toBeInTheDocument();
    // "No data yet." covers exactly 3 empty cards: Most Executed, Action frequency, Node frequency.
    expect(within(panel).getAllByText("No data yet.").length).toBe(3);
    expect(within(panel).getByText("invoice.paid")).toBeInTheDocument();
  });

  it("renders the Dependency Map's circular warning, triggering-workflow edge, and trigger graph entry", async () => {
    vi.mocked(getWorkflowDependencyMapAction).mockResolvedValue({
      success: true,
      data: {
        triggerGraph: { "contract.signed": ["wf_a", "wf_b"] },
        actionGraph: {},
        workflowsTriggeringWorkflows: [makeTriggerEdge({ sourceWorkflowName: "Source Workflow", producedTrigger: "invoice.paid", targetWorkflowIds: ["wf_a", "wf_b"] })],
        circularChains: [["wf_x", "wf_y", "wf_z"]],
        evaluatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Dependency Map" }));
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).getByText("Circular references detected")).toBeInTheDocument();
    expect(within(panel).getByText("wf_x → wf_y → wf_z → wf_x")).toBeInTheDocument();
    expect(within(panel).getByText("Source Workflow")).toBeInTheDocument();
    expect(within(panel).getByText("invoice.paid")).toBeInTheDocument();
    expect(within(panel).getByText("contract.signed")).toBeInTheDocument();
    expect(within(panel).getByText("2 workflow(s)")).toBeInTheDocument();
  });

  it("shows the Dependency Map's empty fallback with no circular warning", async () => {
    vi.mocked(getWorkflowDependencyMapAction).mockResolvedValue({
      success: true,
      data: { triggerGraph: {}, actionGraph: {}, workflowsTriggeringWorkflows: [], circularChains: [], evaluatedAt: "2026-01-01T00:00:00.000Z" },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Dependency Map" }));
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).queryByText("Circular references detected")).not.toBeInTheDocument();
    expect(within(panel).getByText("No workflow-to-workflow trigger chains detected yet.")).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Trigger graph" })).toBeInTheDocument();
  });

  it("renders the Health Panel's KPIs, both workflow reports, an issue message, and the no-issues fallback", async () => {
    vi.mocked(getWorkspaceWorkflowHealthAction).mockResolvedValue({
      success: true,
      data: {
        reports: [
          makeHealthReport({
            workflowId: "wf_issue",
            workflowName: "Issue Workflow",
            score: 40,
            structuralIssues: [{ code: "cycle_detected", message: "This Workflow has a circular reference.", nodeId: null, edgeId: null }],
            findings: [],
          }),
          makeHealthReport({ workflowId: "wf_clean", workflowName: "Clean Workflow", score: 95, structuralIssues: [], findings: [] }),
        ],
        averageScore: 68,
        totalFindings: 1,
        evaluatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Health Panel" }));
    const panel = await screen.findByRole("tabpanel");

    expect(within(panel).getByText("68/100")).toBeInTheDocument();
    expect(within(panel).getByText("1")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Issue Workflow" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Clean Workflow" })).toBeInTheDocument();
    expect(within(panel).getByText("40/100")).toBeInTheDocument();
    expect(within(panel).getByText("95/100")).toBeInTheDocument();
    expect(within(panel).getByText("This Workflow has a circular reference.")).toBeInTheDocument();
    expect(within(panel).getByText("No issues detected.")).toBeInTheDocument();
  });

  it("shows the Health Panel's empty state when there are no workflows", async () => {
    vi.mocked(getWorkspaceWorkflowHealthAction).mockResolvedValue({
      success: true,
      data: { reports: [], averageScore: null, totalFindings: 0, evaluatedAt: "2026-01-01T00:00:00.000Z" },
    });

    render(<WorkflowMonitoringCenterView />);
    const healthTab = await screen.findByRole("tab", { name: "Health Panel" });
    await userEvent.click(healthTab);
    expect(healthTab).toHaveAttribute("aria-selected", "true");

    const panel = await screen.findByRole("tabpanel");
    expect(within(panel).getByText("No workflows yet")).toBeInTheDocument();
  });

  it("renders Error Center's populated table, open/total heading, and duplicated mobile card", async () => {
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [makeErrorRecord({ executionId: "err_pop_1", actionId: "action_pop", workflowName: "Overdue Invoice Reminder Workflow", acknowledgement: "open" })],
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: /Error Center/ }));
    await screen.findByRole("tabpanel");

    // The heading (with its "(N open of M)" count) is rendered once for desktop and once for mobile.
    expect(screen.getAllByText(/1 open of 1/).length).toBe(2);

    const table = screen.getByRole("table");
    expect(within(table).getByText("open")).toBeInTheDocument();
    expect(within(table).getByText("Overdue Invoice Reminder Workflow")).toBeInTheDocument();

    expect(screen.getAllByText("Overdue Invoice Reminder Workflow").length).toBe(2);
    expect(screen.getAllByText("open").length).toBe(2);
  });

  it("wires Error Center's own Retry button to retryWorkflowExecutionAction with a success toast", async () => {
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [makeErrorRecord({ executionId: "err_retry_own", actionId: "action_retry", workflowName: "Error Center Retry Workflow", acknowledgement: "open" })],
    });
    vi.mocked(retryWorkflowExecutionAction).mockResolvedValue({
      success: true,
      data: {
        id: "err_retry_own",
        workspaceId: "ws_1",
        automationId: "automation_1",
        automationName: "Error Center Retry Workflow",
        automationVersion: "v1",
        trigger: "invoice.overdue",
        triggerFacts: {},
        conditionsPassed: true,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "success",
        durationMs: 100,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: /Error Center/ }));
    // "Error Center Retry Workflow" renders twice — once desktop, once mobile.
    await screen.findAllByText("Error Center Retry Workflow");

    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    await userEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(retryWorkflowExecutionAction).toHaveBeenCalledWith("err_retry_own");
    });
    expect(await screen.findByText("Execution re-run — new status: success.")).toBeInTheDocument();
  });

  it("wires Ignore and Archive to their actions and reflects the refreshed acknowledgement", async () => {
    const errorA = makeErrorRecord({ executionId: "err_A", actionId: "action_A", workflowName: "Ignore Target Workflow", acknowledgement: "open" });
    const errorB = makeErrorRecord({ executionId: "err_B", actionId: "action_B", workflowName: "Archive Target Workflow", acknowledgement: "ignored" });

    vi.mocked(getWorkflowErrorsAction)
      .mockResolvedValueOnce({ success: true, data: [errorA, errorB] })
      .mockResolvedValueOnce({ success: true, data: [{ ...errorA, acknowledgement: "ignored" }, errorB] })
      .mockResolvedValueOnce({ success: true, data: [{ ...errorA, acknowledgement: "ignored" }, { ...errorB, acknowledgement: "archived" }] });
    vi.mocked(ignoreWorkflowErrorAction).mockResolvedValue({ success: true });
    vi.mocked(archiveWorkflowErrorAction).mockResolvedValue({ success: true });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: /Error Center/ }));
    // "Ignore Target Workflow" renders twice — once desktop, once mobile.
    await screen.findAllByText("Ignore Target Workflow");

    // Ignore is only enabled while acknowledgement === "open" — Error A qualifies, Error B does not.
    expect(within(screen.getByRole("table")).getByText("open")).toBeInTheDocument();
    const ignoreButtons = screen.getAllByRole("button", { name: "Ignore" });
    await userEvent.click(ignoreButtons[0]);

    await waitFor(() => {
      expect(ignoreWorkflowErrorAction).toHaveBeenCalledWith("err_A", "action_A");
    });
    // No success Toast exists for Ignore — the only proof of success is the refetched acknowledgement.
    await waitFor(() => {
      expect(within(screen.getByRole("table")).queryByText("open")).not.toBeInTheDocument();
    });

    // Both rows are now "ignored" (not yet "archived"), so Archive is enabled on both.
    const archiveButtons = screen.getAllByRole("button", { name: "Archive" });
    await userEvent.click(archiveButtons[1]);

    await waitFor(() => {
      expect(archiveWorkflowErrorAction).toHaveBeenCalledWith("err_B", "action_B");
    });
    await waitFor(() => {
      expect(within(screen.getByRole("table")).getByText("archived")).toBeInTheDocument();
    });
  });

  it("shows a danger toast with the exact error message when Error Center Retry fails", async () => {
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({
      success: true,
      data: [makeErrorRecord({ executionId: "err_fail", actionId: "action_fail", workflowName: "Failing Retry Workflow", acknowledgement: "open" })],
    });
    vi.mocked(retryWorkflowExecutionAction).mockResolvedValue({ success: false, error: "The Automation Engine is temporarily unavailable." });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: /Error Center/ }));
    // "Failing Retry Workflow" renders twice — once desktop, once mobile.
    await screen.findAllByText("Failing Retry Workflow");

    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    await userEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(retryWorkflowExecutionAction).toHaveBeenCalledWith("err_fail");
    });
    expect(await screen.findByText("The Automation Engine is temporarily unavailable.")).toBeInTheDocument();
  });

  it("shows the Error Center's empty state when there are no workflow errors", async () => {
    vi.mocked(getWorkflowErrorsAction).mockResolvedValue({ success: true, data: [] });

    render(<WorkflowMonitoringCenterView />);
    const errorsTab = await screen.findByRole("tab", { name: /Error Center/ });
    await userEvent.click(errorsTab);
    expect(errorsTab).toHaveAttribute("aria-selected", "true");

    expect(await screen.findByText("No workflow errors")).toBeInTheDocument();
  });

  it("wires Execution History Clone to cloneWorkflowExecutionAction with a success toast and refresh", async () => {
    vi.mocked(getWorkflowExecutionHistoryAction).mockResolvedValue({
      success: true,
      data: [makeExecutionSummary({ executionId: "exec_clone_1", workflowName: "Clonable Workflow" })],
    });
    vi.mocked(cloneWorkflowExecutionAction).mockResolvedValue({
      success: true,
      data: {
        id: "exec_clone_1",
        workspaceId: "ws_1",
        automationId: "automation_1",
        automationName: "Clonable Workflow",
        automationVersion: "v1",
        trigger: "invoice.overdue",
        triggerFacts: {},
        conditionsPassed: true,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "success",
        durationMs: 100,
        startedAt: "2026-01-01T00:00:00.000Z",
        completedAt: "2026-01-01T00:00:01.000Z",
      },
    });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Execution History" }));
    // "Clonable Workflow" renders twice — once desktop, once mobile.
    await screen.findAllByText("Clonable Workflow");

    const callsBefore = vi.mocked(getWorkflowExecutionHistoryAction).mock.calls.length;
    const cloneButtons = screen.getAllByRole("button", { name: "Clone" });
    await userEvent.click(cloneButtons[0]);

    await waitFor(() => {
      expect(cloneWorkflowExecutionAction).toHaveBeenCalledWith("exec_clone_1");
    });
    expect(await screen.findByText("Execution cloned — new status: success.")).toBeInTheDocument();
    await waitFor(() => {
      expect(vi.mocked(getWorkflowExecutionHistoryAction).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("wires Execution History Export through the full browser download path", async () => {
    vi.mocked(getWorkflowExecutionHistoryAction).mockResolvedValue({
      success: true,
      data: [makeExecutionSummary({ executionId: "exec_export_1", workflowName: "Exportable Workflow" })],
    });
    vi.mocked(exportWorkflowExecutionLogAction).mockResolvedValue({ success: true, data: '{"distinctive":"export-payload"}' });

    const fakeObjectUrl = "blob:fake-object-url";
    const createObjectURLSpy = vi.fn().mockReturnValue(fakeObjectUrl);
    const revokeObjectURLSpy = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = revokeObjectURLSpy;

    const createdAnchors: HTMLAnchorElement[] = [];
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName === "a") createdAnchors.push(el as HTMLAnchorElement);
      return el;
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    try {
      render(<WorkflowMonitoringCenterView />);
      await userEvent.click(await screen.findByRole("tab", { name: "Execution History" }));
      // "Exportable Workflow" renders twice — once desktop, once mobile.
      await screen.findAllByText("Exportable Workflow");

      const exportButtons = screen.getAllByRole("button", { name: "Export" });
      await userEvent.click(exportButtons[0]);

      await waitFor(() => {
        expect(exportWorkflowExecutionLogAction).toHaveBeenCalledWith("exec_export_1");
      });
      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalled();
      });

      expect(createdAnchors.length).toBeGreaterThan(0);
      const anchor = createdAnchors[createdAnchors.length - 1];
      expect(anchor.getAttribute("href")).toBe(fakeObjectUrl);
      expect(anchor.getAttribute("download")).toBe("exec_export_1.json");
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(fakeObjectUrl);
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("renders the Audit tab's populated table, mobile duplication, version-format distinction, and its own Export call site", async () => {
    vi.mocked(getWorkflowAuditLogAction).mockResolvedValue({
      success: true,
      data: [
        makeAuditRecord({
          executionId: "audit_exec_pop",
          workflowName: "Audit Trail Workflow",
          versionExecuted: "3",
          actor: "Amoré Bloom Owner",
          nodePath: ["trigger_node", "action_node"],
          durationMs: 250,
        }),
      ],
    });
    vi.mocked(exportWorkflowExecutionLogAction).mockResolvedValue({ success: true, data: "{}" });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Audit" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Audit Trail Workflow")).toBeInTheDocument();
    // Desktop renders the bare version string; mobile renders a "v"-prefixed version —
    // a real, current desktop/mobile formatting inconsistency this test protects exactly.
    expect(within(table).getByText("3")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(within(table).getByText("trigger_node → action_node")).toBeInTheDocument();
    expect(within(table).getByText("Amoré Bloom Owner")).toBeInTheDocument();
    expect(within(table).getByText("250ms")).toBeInTheDocument();

    expect(screen.getAllByText("Audit Trail Workflow").length).toBe(2);
    expect(screen.getAllByText("Amoré Bloom Owner").length).toBe(2);

    const exportButtons = screen.getAllByRole("button", { name: "Export" });
    await userEvent.click(exportButtons[0]);

    await waitFor(() => {
      expect(exportWorkflowExecutionLogAction).toHaveBeenCalledWith("audit_exec_pop");
    });
  });

  it("shows the Audit tab's empty state when there are no audit records", async () => {
    vi.mocked(getWorkflowAuditLogAction).mockResolvedValue({ success: true, data: [] });

    render(<WorkflowMonitoringCenterView />);
    await userEvent.click(await screen.findByRole("tab", { name: "Audit" }));

    expect(await screen.findByText("No audit records yet")).toBeInTheDocument();
    expect(screen.getByText("Every workflow execution produces an immutable audit record here.")).toBeInTheDocument();
  });
});

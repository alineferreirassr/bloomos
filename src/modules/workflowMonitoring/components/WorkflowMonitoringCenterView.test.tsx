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
});

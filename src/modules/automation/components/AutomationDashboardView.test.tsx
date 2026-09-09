import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutomationDashboardView } from "@/modules/automation/components/AutomationDashboardView";
import { resetCommandRegistry } from "@/core/commandPalette";
import type { AutomationDashboardData, AutomationActionSummary, AutomationExecutionStats } from "@/modules/automation/getAutomationDashboardData";
import type { AutomationDefinition, AutomationExecution } from "@/types/automation";

vi.mock("@/modules/automation/getAutomationDashboardData", () => ({
  getAutomationDashboardData: vi.fn(),
}));
vi.mock("@/modules/automation/approveAutomationExecution", () => ({
  approveAutomationExecution: vi.fn(),
}));
vi.mock("@/modules/automation/rejectAutomationExecution", () => ({
  rejectAutomationExecution: vi.fn(),
}));

import { getAutomationDashboardData } from "@/modules/automation/getAutomationDashboardData";
import { approveAutomationExecution } from "@/modules/automation/approveAutomationExecution";
import { rejectAutomationExecution } from "@/modules/automation/rejectAutomationExecution";

function makeAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "automation_1",
    name: "Notify on Overdue Invoice",
    description: "Sends a notification when an invoice becomes overdue.",
    category: "finance",
    version: "v1",
    status: "active",
    trigger: "invoice.overdue",
    conditions: [],
    actionIds: [],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function makeAction(overrides: Partial<AutomationActionSummary> = {}): AutomationActionSummary {
  return {
    id: "action_1",
    name: "Create Notification",
    description: "Creates an in-app notification for the assigned member.",
    category: "notifications",
    version: "v1",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

function makeExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "execution_1",
    workspaceId: "ws_1",
    automationId: "automation_1",
    automationName: "Notify on Overdue Invoice",
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
    ...overrides,
  };
}

function makeStats(overrides: Partial<AutomationExecutionStats> = {}): AutomationExecutionStats {
  return {
    totalExecutions: 0,
    byStatus: {
      success: 0,
      failure: 0,
      partial_failure: 0,
      pending_approval: 0,
      skipped_conditions_not_met: 0,
      rejected: 0,
    },
    averageDurationMs: 0,
    successRatePercent: null,
    ...overrides,
  };
}

function makeData(overrides: Partial<AutomationDashboardData> = {}): AutomationDashboardData {
  return {
    recentExecutions: [],
    pendingApprovals: [],
    approvableExecutionIds: [],
    registeredAutomations: [],
    registeredActions: [],
    triggerSummary: [],
    stats: makeStats(),
    failureSummary: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetCommandRegistry();
});

describe("AutomationDashboardView", () => {
  it("shows the loading state before dashboard data resolves", () => {
    vi.mocked(getAutomationDashboardData).mockReturnValue(new Promise(() => {}));

    const { container } = render(<AutomationDashboardView />);

    expect(container.querySelectorAll(".luxury-shimmer").length).toBeGreaterThan(0);
  });

  it("shows an error state and retries the load on demand", async () => {
    vi.mocked(getAutomationDashboardData)
      .mockResolvedValueOnce({ success: false, error: "Could not load the Automation Dashboard." })
      .mockResolvedValueOnce({ success: true, data: makeData() });

    render(<AutomationDashboardView />);

    expect(await screen.findByText("Could not load the Automation Dashboard.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(getAutomationDashboardData).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Success Rate")).toBeInTheDocument();
  });

  it("renders the VM02-relocated Engine Health KPI row with distinctive values", async () => {
    vi.mocked(getAutomationDashboardData).mockResolvedValue({
      success: true,
      data: makeData({
        stats: makeStats({ successRatePercent: 83 }),
        registeredAutomations: [
          makeAutomation({ id: "a1" }),
          makeAutomation({ id: "a2" }),
          makeAutomation({ id: "a3" }),
          makeAutomation({ id: "a4" }),
        ],
        registeredActions: [
          makeAction({ id: "act1" }),
          makeAction({ id: "act2" }),
          makeAction({ id: "act3" }),
          makeAction({ id: "act4" }),
          makeAction({ id: "act5" }),
          makeAction({ id: "act6" }),
          makeAction({ id: "act7" }),
        ],
        triggerSummary: [
          { type: "contract.signed", listenerCount: 0 },
          { type: "event.completed", listenerCount: 0 },
        ],
      }),
    });

    render(<AutomationDashboardView />);
    await screen.findByRole("heading", { name: "Registered Automations" });

    expect(screen.getByText("Success Rate")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("Triggers With No Listener")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Registered Automations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Registered Actions" })).toBeInTheDocument();
  });

  it("shows all four empty-state messages when every dashboard list is empty", async () => {
    vi.mocked(getAutomationDashboardData).mockResolvedValue({ success: true, data: makeData() });

    render(<AutomationDashboardView />);

    expect(await screen.findByText("Nothing is waiting on approval")).toBeInTheDocument();
    expect(screen.getByText("No failures")).toBeInTheDocument();
    expect(screen.getByText("No Automation is visible yet")).toBeInTheDocument();
    expect(screen.getByText("No Automation has run yet")).toBeInTheDocument();
  });

  it("renders populated Pending Approvals and Failure Summary content", async () => {
    vi.mocked(getAutomationDashboardData).mockResolvedValue({
      success: true,
      data: makeData({
        pendingApprovals: [
          makeExecution({
            id: "exec_pending_1",
            automationName: "Generate Proposal Document",
            trigger: "proposal.accepted",
            status: "pending_approval",
            approvalStatus: "pending",
          }),
        ],
        approvableExecutionIds: ["exec_pending_1"],
        failureSummary: [
          { automationId: "automation_2", automationName: "Sync Finance Report", failureCount: 3, lastFailureAt: "2026-02-02T08:00:00.000Z" },
        ],
      }),
    });

    render(<AutomationDashboardView />);

    expect(await screen.findByRole("heading", { name: "Needs Attention" })).toBeInTheDocument();
    expect(screen.getByText("Generate Proposal Document")).toBeInTheDocument();
    expect(screen.getByText("Sync Finance Report")).toBeInTheDocument();
    expect(screen.getByText(/3 failures/)).toBeInTheDocument();
  });

  it("wires Approve and Reject to their actions and shows success feedback", async () => {
    const pending = makeExecution({ id: "exec_1", automationName: "Notify on Overdue Invoice" });
    vi.mocked(getAutomationDashboardData).mockResolvedValue({
      success: true,
      data: makeData({ pendingApprovals: [pending], approvableExecutionIds: ["exec_1"] }),
    });
    vi.mocked(approveAutomationExecution).mockResolvedValue({ success: true, data: { ...pending, status: "success" } });
    vi.mocked(rejectAutomationExecution).mockResolvedValue({ success: true, data: { ...pending, status: "rejected" } });

    render(<AutomationDashboardView />);
    await screen.findByText("Notify on Overdue Invoice");

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => {
      expect(approveAutomationExecution).toHaveBeenCalledWith("exec_1");
    });
    expect(await screen.findByText("Automation approved — ran successfully.")).toBeInTheDocument();

    await screen.findByText("Notify on Overdue Invoice");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => {
      expect(rejectAutomationExecution).toHaveBeenCalledWith("exec_1");
    });
    expect(await screen.findByText("Automation rejected.")).toBeInTheDocument();
  });

  it("renders populated Registered Automations, Triggers, and Actions sections", async () => {
    vi.mocked(getAutomationDashboardData).mockResolvedValue({
      success: true,
      data: makeData({
        registeredAutomations: [makeAutomation({ id: "a1", name: "Notify on Overdue Invoice", trigger: "invoice.overdue", status: "active" })],
        triggerSummary: [{ type: "contract.signed", listenerCount: 3 }],
        registeredActions: [makeAction({ id: "act1", name: "Create Notification", category: "notifications", description: "Creates an in-app notification for the assigned member." })],
      }),
    });

    render(<AutomationDashboardView />);

    expect(await screen.findByRole("heading", { name: "Registered Automations" })).toBeInTheDocument();
    expect(screen.getByText("Notify on Overdue Invoice")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Registered Actions" })).toBeInTheDocument();
    expect(screen.getByText("Create Notification")).toBeInTheDocument();
    expect(screen.getByText("notifications")).toBeInTheDocument();
    expect(screen.getByText("Creates an in-app notification for the assigned member.")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Registered Triggers" })).toBeInTheDocument();
    expect(screen.getByText("Contract Signed")).toBeInTheDocument();
    expect(screen.getByText("3 listeners")).toBeInTheDocument();
  });

  it("renders populated Recent Executions and Execution Statistics", async () => {
    vi.mocked(getAutomationDashboardData).mockResolvedValue({
      success: true,
      data: makeData({
        recentExecutions: [
          makeExecution({
            id: "exec_recent_1",
            automationName: "Sync Finance Report",
            trigger: "invoice.paid",
            status: "success",
            durationMs: 245,
            actionResults: [{ actionId: "a1", status: "success", message: "ok", attempts: 1 }],
          }),
        ],
        stats: makeStats({ totalExecutions: 5, byStatus: { success: 5, failure: 0, partial_failure: 0, pending_approval: 0, skipped_conditions_not_met: 0, rejected: 0 }, averageDurationMs: 300, successRatePercent: 100 }),
      }),
    });

    render(<AutomationDashboardView />);
    await screen.findByText("Sync Finance Report");

    const executionsList = screen.getByRole("list", { name: "Recent Executions" });
    expect(within(executionsList).getByText("Success")).toBeInTheDocument();
    expect(within(executionsList).getByText(/245ms/)).toBeInTheDocument();
    expect(within(executionsList).getByText(/1 action/)).toBeInTheDocument();

    const statsHeading = screen.getByRole("heading", { name: "Execution Statistics" });
    const statsCard = within(statsHeading.parentElement as HTMLElement);
    expect(statsCard.getByText("Success")).toBeInTheDocument();
    expect(statsCard.getByText("5")).toBeInTheDocument();
  });
});

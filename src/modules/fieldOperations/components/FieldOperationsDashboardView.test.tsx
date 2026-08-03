import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldOperationsDashboardView } from "@/modules/fieldOperations/components/FieldOperationsDashboardView";
import type { EvaluateFieldOperationsPlatformHealthResult } from "@/modules/fieldOperations/fieldOperationsActions";
import type { FieldOperation, ExecutionSession } from "@/types/fieldOperations";

vi.mock("@/modules/fieldOperations/fieldOperationsActions", () => ({
  listFieldOperationsAction: vi.fn(),
  evaluateFieldOperationsPlatformHealthAction: vi.fn(),
}));

import { listFieldOperationsAction, evaluateFieldOperationsPlatformHealthAction } from "@/modules/fieldOperations/fieldOperationsActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "session_1",
    field_operation_id: "field_operation_abcd1234",
    lifecycle_state: "started",
    outcome: null,
    reason: null,
    current_phase_id: null,
    completed_step_ids: [],
    completed_milestone_ids: [],
    completed_checklist_item_ids: [],
    completed_deliverable_ids: [],
    started_at: NOW,
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    created_at: NOW,
    updated_at: NOW,
    attempts: [],
    ...overrides,
  };
}

function makeOperation(overrides: Partial<FieldOperation> = {}): FieldOperation {
  return {
    id: "field_operation_abcd1234",
    workspace_id: "ws_1",
    dispatch_order_id: "dispatch_order_1",
    dispatch_assignment_id: "assignment_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    priority: "medium",
    context: null,
    status: "active",
    sessions: [makeSession()],
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<EvaluateFieldOperationsPlatformHealthResult> = {}): EvaluateFieldOperationsPlatformHealthResult {
  return { results: [], findings: [], ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateFieldOperationsPlatformHealthResult> = {}) {
  const operation = makeOperation();
  vi.mocked(listFieldOperationsAction).mockResolvedValue({ success: true, data: [operation] });
  vi.mocked(evaluateFieldOperationsPlatformHealthAction).mockResolvedValue({
    success: true,
    data: makeHealth({
      results: [
        {
          fieldOperation: operation,
          session: operation.sessions[0],
          validation: { valid: true, errors: [], warnings: [] },
          state: { currentState: "started", previousState: "created", transitionHistory: [], elapsedTimeSeconds: 0, pauseDurationSeconds: 0, executionDurationSeconds: 0, completionDurationSeconds: null },
          health: { executionHealth: 100, progressHealth: 100, pauseHealth: 100, completionHealth: 100, lifecycleHealth: 100, overallOperationalHealth: 100 },
          explanation: { summary: "", whyCannotStart: [], whyPaused: [], whyResumed: [], whyFailed: [], whyCompletionRejected: [], healthSummary: "" },
          progress: { currentPhaseId: null, completedStepIds: [], remainingStepIds: [], completedMilestoneIds: [], pendingMilestoneIds: [], checklistProgress: 100, deliverableProgress: 100, evidenceProgressPlaceholder: null },
        },
      ],
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.mocked(listFieldOperationsAction).mockReset();
  vi.mocked(evaluateFieldOperationsPlatformHealthAction).mockReset();
});

describe("FieldOperationsDashboardView", () => {
  it("renders KPI cards and the field operations list once data resolves", async () => {
    mockAllSucceed();
    render(<FieldOperationsDashboardView />);

    expect(await screen.findByText("Field Operation #abcd1234")).toBeInTheDocument();
    expect(screen.getByText("No high-severity findings.")).toBeInTheDocument();
    expect(screen.getByText("No operations are currently blocked.")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listFieldOperationsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateFieldOperationsPlatformHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<FieldOperationsDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "execution_blocked", severity: "high", description: "This field operation is blocked by validation issues.", relatedFieldOperationId: "field_operation_abcd1234" }] });
    render(<FieldOperationsDashboardView />);
    expect(await screen.findByText("This field operation is blocked by validation issues.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no field operations", async () => {
    vi.mocked(listFieldOperationsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateFieldOperationsPlatformHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<FieldOperationsDashboardView />);
    expect(await screen.findByText("No field operations yet")).toBeInTheDocument();
  });

  it("lists a blocked operation when validation is invalid", async () => {
    const operation = makeOperation();
    vi.mocked(listFieldOperationsAction).mockResolvedValue({ success: true, data: [operation] });
    vi.mocked(evaluateFieldOperationsPlatformHealthAction).mockResolvedValue({
      success: true,
      data: makeHealth({
        results: [
          {
            fieldOperation: operation,
            session: operation.sessions[0],
            validation: { valid: false, errors: [{ rule: "worker_assigned", detail: "No worker is assigned." }], warnings: [] },
            state: { currentState: "created", previousState: null, transitionHistory: [], elapsedTimeSeconds: 0, pauseDurationSeconds: 0, executionDurationSeconds: 0, completionDurationSeconds: null },
            health: { executionHealth: 0, progressHealth: 100, pauseHealth: 100, completionHealth: 100, lifecycleHealth: 100, overallOperationalHealth: 80 },
            explanation: { summary: "", whyCannotStart: ["No worker is assigned."], whyPaused: [], whyResumed: [], whyFailed: [], whyCompletionRejected: [], healthSummary: "" },
            progress: { currentPhaseId: null, completedStepIds: [], remainingStepIds: [], completedMilestoneIds: [], pendingMilestoneIds: [], checklistProgress: 0, deliverableProgress: 0, evidenceProgressPlaceholder: null },
          },
        ],
      }),
    });

    render(<FieldOperationsDashboardView />);
    expect(await screen.findByText("No worker is assigned.")).toBeInTheDocument();
  });
});

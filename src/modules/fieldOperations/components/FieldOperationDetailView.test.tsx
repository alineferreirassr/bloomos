import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldOperationDetailView } from "@/modules/fieldOperations/components/FieldOperationDetailView";
import type { FieldOperation, ExecutionSession, ExecutionResult } from "@/types/fieldOperations";

vi.mock("@/modules/fieldOperations/fieldOperationsActions", () => ({
  getFieldOperationAction: vi.fn(),
  evaluateFieldOperationAction: vi.fn(),
}));

import { getFieldOperationAction, evaluateFieldOperationAction } from "@/modules/fieldOperations/fieldOperationsActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "session_1",
    field_operation_id: "field_operation_abcd1234",
    lifecycle_state: "started",
    outcome: null,
    reason: null,
    current_phase_id: "phase_1",
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
    attempts: [{ id: "attempt_1", session_id: "session_1", lifecycle_state: "started", reason: null, created_at: NOW }],
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

const PERFECT_RESULT: ExecutionResult = {
  fieldOperation: makeOperation(),
  session: makeSession(),
  validation: { valid: true, errors: [], warnings: [] },
  state: { currentState: "started", previousState: "created", transitionHistory: [], elapsedTimeSeconds: 3600, pauseDurationSeconds: 0, executionDurationSeconds: 3600, completionDurationSeconds: null },
  health: { executionHealth: 100, progressHealth: 100, pauseHealth: 100, completionHealth: 100, lifecycleHealth: 100, overallOperationalHealth: 100 },
  explanation: { summary: "Overall operational health 100/100.", whyCannotStart: [], whyPaused: [], whyResumed: [], whyFailed: [], whyCompletionRejected: [], healthSummary: "Execution is healthy." },
  progress: { currentPhaseId: "phase_1", completedStepIds: [], remainingStepIds: ["step_1"], completedMilestoneIds: [], pendingMilestoneIds: ["milestone_1"], checklistProgress: 50, deliverableProgress: 0, evidenceProgressPlaceholder: null },
};

beforeEach(() => {
  vi.mocked(getFieldOperationAction).mockReset();
  vi.mocked(evaluateFieldOperationAction).mockReset();
});

describe("FieldOperationDetailView", () => {
  it("renders the operation's id, lifecycle state, and transitions", async () => {
    vi.mocked(getFieldOperationAction).mockResolvedValue({ success: true, data: makeOperation() });

    render(<FieldOperationDetailView operationId="field_operation_abcd1234" />);

    expect(await screen.findByRole("heading", { name: "Field Operation #abcd1234" })).toBeInTheDocument();
    expect(screen.getByText("phase_1")).toBeInTheDocument();
    expect(screen.getAllByText("started").length).toBeGreaterThan(0);
  });

  it("renders an error state when the field operation can't be found", async () => {
    vi.mocked(getFieldOperationAction).mockResolvedValue({ success: false, error: "This field operation could not be found." });

    render(<FieldOperationDetailView operationId="field_operation_missing" />);
    expect(await screen.findByText("This field operation could not be found.")).toBeInTheDocument();
  });

  it("re-derives and displays health/progress when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getFieldOperationAction).mockResolvedValue({ success: true, data: makeOperation() });
    vi.mocked(evaluateFieldOperationAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<FieldOperationDetailView operationId="field_operation_abcd1234" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("Overall operational health 100/100.")).toBeInTheDocument();
    expect(screen.getByText("Execution is healthy.")).toBeInTheDocument();
  });
});

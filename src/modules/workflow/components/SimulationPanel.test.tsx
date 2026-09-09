import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SimulationPanel } from "@/modules/workflow/components/SimulationPanel";
import type { WorkflowSimulationResult, WorkflowSimulationPath, WorkflowSimulationStep } from "@/types/workflow";

function makeStep(overrides: Partial<WorkflowSimulationStep> = {}): WorkflowSimulationStep {
  return {
    nodeId: "step_1",
    kind: "trigger",
    name: "Lead Intake",
    preview: "Fires when a new Lead is created.",
    branch: null,
    ...overrides,
  };
}

function makePath(overrides: Partial<WorkflowSimulationPath> = {}): WorkflowSimulationPath {
  return {
    triggerNodeId: "trigger_1",
    triggerName: "New Lead Created",
    steps: [makeStep()],
    actionCount: 1,
    ...overrides,
  };
}

function makeResult(overrides: Partial<WorkflowSimulationResult> = {}): WorkflowSimulationResult {
  return {
    valid: true,
    issues: [],
    paths: [],
    nodeCount: 0,
    triggerCount: 0,
    memoryPreview: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SimulationPanel", () => {
  it("shows the pre-run empty state and an enabled Run Simulation button", () => {
    render(<SimulationPanel result={null} running={false} onRun={vi.fn()} />);

    expect(screen.getByText("No simulation run yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Simulation" })).not.toBeDisabled();
  });

  it("shows the structural-issue copy for an invalid result, with no counts row", () => {
    render(<SimulationPanel result={makeResult({ valid: false })} running={false} onRun={vi.fn()} />);

    expect(
      screen.getByText("This graph has structural issues — fix Validation first, then simulate again."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nodes$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/paths?$/)).not.toBeInTheDocument();
  });

  it("shows the A6 empty-path state for a valid result with no reachable paths", () => {
    render(
      <SimulationPanel
        result={makeResult({ valid: true, paths: [], nodeCount: 2, triggerCount: 1 })}
        running={false}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByText("1 triggers")).toBeInTheDocument();
    expect(screen.getByText("0 paths")).toBeInTheDocument();
    expect(screen.getByText("No path reaches a real step yet")).toBeInTheDocument();
    expect(screen.getByText("Add a Trigger and connect it to at least one step.")).toBeInTheDocument();
  });

  it("renders a populated simulation path with its steps and the memoryPreview note", () => {
    const path = makePath({
      triggerName: "New Lead Created",
      actionCount: 2,
      steps: [
        makeStep({ nodeId: "step_1", kind: "trigger", name: "Lead Intake", preview: "Fires when a new Lead is created.", branch: null }),
        makeStep({ nodeId: "step_2", kind: "condition", name: "High Budget", preview: "Branches when budget exceeds $5,000.", branch: "true" }),
      ],
    });
    render(
      <SimulationPanel
        result={makeResult({
          valid: true,
          nodeCount: 3,
          triggerCount: 1,
          paths: [path],
          memoryPreview: { approvedCount: 3, pendingCount: 1 },
        })}
        running={false}
        onRun={vi.fn()}
      />,
    );

    expect(screen.getByText("Path 1 — New Lead Created")).toBeInTheDocument();
    expect(screen.getByText("2 actions")).toBeInTheDocument();
    expect(screen.getByText("trigger")).toBeInTheDocument();
    expect(screen.getByText("condition")).toBeInTheDocument();
    expect(screen.getByText("Lead Intake")).toBeInTheDocument();
    expect(screen.getByText("High Budget")).toBeInTheDocument();
    expect(screen.getByText("Fires when a new Lead is created.")).toBeInTheDocument();
    expect(screen.getByText("Branches when budget exceeds $5,000.")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    const expectedMemoryNote =
      "A path here touches Memory — this Workspace currently has 3 approved and 1 pending Memory entries (read-only, via the real Memory Layer).";
    expect(
      screen.getByText((_, element) => element?.textContent === expectedMemoryNote),
    ).toBeInTheDocument();
  });

  it("disables Run Simulation and shows 'Simulating…' while a simulation is in flight", () => {
    render(<SimulationPanel result={null} running={true} onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Simulating…" })).toBeDisabled();
  });

  it("calls onRun when Run Simulation is clicked", async () => {
    const onRun = vi.fn();
    render(<SimulationPanel result={null} running={false} onRun={onRun} />);

    await userEvent.click(screen.getByRole("button", { name: "Run Simulation" }));

    expect(onRun).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { listWorkflowSimulationRuns, recordWorkflowSimulationRun, resetWorkflowSimulationStore } from "@/lib/data/core/workflow/simulationStore";

afterEach(() => {
  resetWorkflowSimulationStore();
});

describe("workflowSimulationStore", () => {
  it("records a run with the given workspace/workflow/path/issue counts", () => {
    recordWorkflowSimulationRun("ws_1", "wf_1", 3, 1);
    const [run] = listWorkflowSimulationRuns("ws_1");
    expect(run).toMatchObject({ workspace_id: "ws_1", workflow_id: "wf_1", path_count: 3, issue_count: 1 });
    expect(run.occurred_at).toBeTruthy();
  });

  it("scopes listing to one workspace, never leaking another Workspace's runs", () => {
    recordWorkflowSimulationRun("ws_1", "wf_1", 1, 0);
    recordWorkflowSimulationRun("ws_2", "wf_2", 1, 0);
    expect(listWorkflowSimulationRuns("ws_1")).toHaveLength(1);
    expect(listWorkflowSimulationRuns("ws_2")).toHaveLength(1);
  });

  it("resetWorkflowSimulationStore clears every recorded run", () => {
    recordWorkflowSimulationRun("ws_1", "wf_1", 1, 0);
    resetWorkflowSimulationStore();
    expect(listWorkflowSimulationRuns("ws_1")).toHaveLength(0);
  });
});

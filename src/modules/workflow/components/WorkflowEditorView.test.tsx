import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forwardRef, useImperativeHandle } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowEditorView } from "@/modules/workflow/components/WorkflowEditorView";
import type { WorkflowCanvasHandle, WorkflowCanvasProps } from "@/modules/workflow/canvas/WorkflowCanvas";
import type { WorkflowEditorData } from "@/modules/workflow/getWorkflowEditorData";
import type { WorkflowGraph, WorkflowIssue, WorkflowVersion } from "@/types/workflow";

const canvasMocks = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
  duplicateSelected: vi.fn(),
  addNode: vi.fn(),
  addAnnotation: vi.fn(),
  updateNodeData: vi.fn(),
}));

let capturedCanvasProps: WorkflowCanvasProps | undefined;

vi.mock("@/modules/workflow/canvas/WorkflowCanvas", () => ({
  WorkflowCanvas: forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(function MockWorkflowCanvas(props, ref) {
    capturedCanvasProps = props;
    useImperativeHandle(ref, () => ({
      ...canvasMocks,
      canUndo: false,
      canRedo: false,
    }));
    return null;
  }),
}));

vi.mock("@/modules/workflow/getWorkflowEditorData", () => ({ getWorkflowEditorData: vi.fn() }));
vi.mock("@/modules/workflow/updateWorkflowDraft", () => ({ updateWorkflowDraft: vi.fn() }));
vi.mock("@/modules/workflow/validateWorkflowDraft", () => ({ validateWorkflowDraft: vi.fn() }));
vi.mock("@/modules/workflow/simulateWorkflowAction", () => ({ simulateWorkflowAction: vi.fn() }));
vi.mock("@/modules/workflow/publishWorkflowAction", () => ({ publishWorkflowAction: vi.fn() }));
vi.mock("@/modules/workflow/restoreWorkflowVersion", () => ({ restoreWorkflowVersion: vi.fn() }));

import { getWorkflowEditorData } from "@/modules/workflow/getWorkflowEditorData";
import { updateWorkflowDraft } from "@/modules/workflow/updateWorkflowDraft";
import { validateWorkflowDraft } from "@/modules/workflow/validateWorkflowDraft";
import { simulateWorkflowAction } from "@/modules/workflow/simulateWorkflowAction";
import { publishWorkflowAction } from "@/modules/workflow/publishWorkflowAction";

const WORKFLOW_ID = "wf_1";

const NODE = {
  id: "node_1",
  kind: "action" as const,
  nodeTypeId: "action.send-email",
  position: { x: 0, y: 0 },
  label: "Send Email",
  data: {},
};

const GRAPH: WorkflowGraph = { nodes: [NODE], edges: [], variables: [] };

const NODE_CATALOG = [
  {
    id: "action.send-email",
    kind: "action" as const,
    category: "action" as const,
    name: "Send Email",
    description: "Sends an email.",
    icon: "mail",
    color: "accent",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    compileTarget: null,
  },
];

const METADATA = { name: "Onboarding Flow", description: "", category: "operations" as const, tags: [] };
const EXECUTION_POLICY = { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null };

function makeEditorData(overrides: Partial<WorkflowEditorData> = {}): WorkflowEditorData {
  return {
    workflow: {
      id: WORKFLOW_ID,
      workspaceId: "ws_1",
      status: "draft",
      metadata: METADATA,
      executionPolicy: EXECUTION_POLICY,
      graph: GRAPH,
      currentVersion: 0,
      createdBy: "user_1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      archivedAt: null,
    },
    nodeCatalog: NODE_CATALOG,
    validation: { valid: true, issues: [] },
    versions: [],
    canPublish: true,
    nodeExecutionStats: {},
    ...overrides,
  };
}

function makeVersion(overrides: Partial<WorkflowVersion> = {}): WorkflowVersion {
  return {
    id: "version_1",
    workflowId: WORKFLOW_ID,
    workspaceId: "ws_1",
    version: 1,
    graph: GRAPH,
    metadata: METADATA,
    executionPolicy: EXECUTION_POLICY,
    compiledAutomationIds: ["automation_1"],
    publishedBy: "user_1",
    publishedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function mockReady(overrides: Partial<WorkflowEditorData> = {}) {
  vi.mocked(getWorkflowEditorData).mockResolvedValue({ success: true, data: makeEditorData(overrides) });
}

beforeEach(() => {
  capturedCanvasProps = undefined;
  vi.mocked(updateWorkflowDraft).mockResolvedValue({ success: true, data: makeEditorData().workflow });
  vi.mocked(validateWorkflowDraft).mockResolvedValue({ success: true, data: { valid: true, issues: [] } });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function renderReady(overrides: Partial<WorkflowEditorData> = {}) {
  mockReady(overrides);
  render(<WorkflowEditorView workflowId={WORKFLOW_ID} />);
  await screen.findByText("Onboarding Flow");
}

/** Scopes a query to the tab-panel column only — excludes NodeLibraryPanel
 * (which lists every node-catalog entry by name, colliding with
 * PropertiesPanel's own display of a selected node's name) and PublishDialog
 * (rendered as a sibling of this column, so it can stay open while the
 * Validation tab is checked, colliding on the same issue text/count). */
function panelContent() {
  const panelTabs = screen.getByRole("tablist", { name: "Workflow editor panels" });
  // `Tabs` wraps its `TabList` child in its own div, so the panel-content
  // sibling sits one level up from the tablist itself, not beside it.
  return within(panelTabs.parentElement!.nextElementSibling as HTMLElement);
}

describe("WorkflowEditorView", () => {
  it("shows a loading state before the editor data resolves", () => {
    vi.mocked(getWorkflowEditorData).mockReturnValue(new Promise(() => {}));
    const { container } = render(<WorkflowEditorView workflowId={WORKFLOW_ID} />);
    expect(container.querySelectorAll(".luxury-shimmer").length).toBeGreaterThan(0);
  });

  it("shows the error state with the returned message when the editor data fails to load", async () => {
    vi.mocked(getWorkflowEditorData).mockResolvedValue({ success: false, error: "Could not load this distinctive Workflow." });
    render(<WorkflowEditorView workflowId={WORKFLOW_ID} />);
    expect(await screen.findByText("Could not load this distinctive Workflow.")).toBeInTheDocument();
  });

  it("renders the loaded title, status, version, and gates Publish on canPublish", async () => {
    await renderReady({ canPublish: false });
    expect(screen.getByText("Onboarding Flow")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("switches all five panel tabs, each rendering its own real child content", async () => {
    const user = userEvent.setup();
    await renderReady();

    expect(screen.getByText("No node selected")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Inspector" }));
    expect(screen.getByText("Workflow Inspector")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Validation" }));
    expect(screen.getByText("Ready to publish")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Simulation" }));
    expect(screen.getByText("No simulation run yet")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Versions" }));
    expect(screen.getByText("Version History")).toBeInTheDocument();
    expect(screen.getByText("Not published yet")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Properties" }));
    expect(screen.getByText("No node selected")).toBeInTheDocument();
  });

  it("propagates a clicked Validation issue into the Properties tab's selected node", async () => {
    const user = userEvent.setup();
    const issue: WorkflowIssue = { code: "missing_action", message: "This action node has no config.", nodeId: "node_1", edgeId: null };
    await renderReady({ validation: { valid: false, issues: [issue] } });

    await user.click(screen.getByRole("tab", { name: "Validation" }));
    await user.click(screen.getByRole("button", { name: /missing action/i }));

    await user.click(screen.getByRole("tab", { name: "Properties" }));
    expect(panelContent().queryByText("No node selected")).not.toBeInTheDocument();
    expect(panelContent().getByText("Send Email")).toBeInTheDocument();
  });

  it("autosaves the draft after the 900ms debounce once the canvas reports a graph change", async () => {
    await renderReady();
    vi.useFakeTimers();
    try {
      const nextGraph: WorkflowGraph = { ...GRAPH, nodes: [...GRAPH.nodes, { ...NODE, id: "node_2" }] };

      capturedCanvasProps?.onGraphChange(nextGraph);

      await vi.advanceTimersByTimeAsync(800);
      expect(updateWorkflowDraft).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(updateWorkflowDraft).toHaveBeenCalledWith(WORKFLOW_ID, { graph: nextGraph, metadata: METADATA, executionPolicy: EXECUTION_POLICY });
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates the draft after the 500ms debounce and propagates the returned issues into the Validation tab", async () => {
    await renderReady();
    vi.useFakeTimers();
    try {
      const nextGraph: WorkflowGraph = { ...GRAPH, nodes: [...GRAPH.nodes, { ...NODE, id: "node_2" }] };
      const returnedIssue: WorkflowIssue = { code: "cycle_detected", message: "This graph now has a cycle.", nodeId: "node_2", edgeId: null };
      vi.mocked(validateWorkflowDraft).mockResolvedValue({ success: true, data: { valid: false, issues: [returnedIssue] } });

      capturedCanvasProps?.onGraphChange(nextGraph);
      await vi.advanceTimersByTimeAsync(500);
      expect(validateWorkflowDraft).toHaveBeenCalledWith(WORKFLOW_ID, nextGraph);

      // A plain fireEvent click (not userEvent) avoids userEvent's internal
      // async waiting, which conflicts with fake timers even with `delay: null`.
      fireEvent.click(screen.getByRole("tab", { name: "Validation" }));
      expect(screen.getByText("1 issue")).toBeInTheDocument();
      expect(screen.getByText("cycle detected")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs a simulation against the current graph and renders the real result", async () => {
    const user = userEvent.setup();
    await renderReady();
    const nextGraph: WorkflowGraph = { ...GRAPH, nodes: [...GRAPH.nodes, { ...NODE, id: "node_2" }] };
    capturedCanvasProps?.onGraphChange(nextGraph);

    vi.mocked(simulateWorkflowAction).mockResolvedValue({
      success: true,
      data: { valid: true, issues: [], paths: [], nodeCount: 2, triggerCount: 0, memoryPreview: null },
    });

    await user.click(screen.getByRole("tab", { name: "Simulation" }));
    await user.click(screen.getByRole("button", { name: "Run Simulation" }));

    await waitFor(() => {
      expect(simulateWorkflowAction).toHaveBeenCalledWith(WORKFLOW_ID, nextGraph);
    });
    expect(await screen.findByText("2 nodes")).toBeInTheDocument();
  });

  it("publishes successfully: closes the dialog, updates status/version, and shows a success toast", async () => {
    const user = userEvent.setup();
    await renderReady({ canPublish: true });
    vi.mocked(publishWorkflowAction).mockResolvedValue({ success: true, data: makeVersion({ version: 1, compiledAutomationIds: ["automation_1", "automation_2"] }) });

    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(publishWorkflowAction).toHaveBeenCalledWith(WORKFLOW_ID);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("Published as version 1 — 2 Automation(s) registered.");
  });

  it("shows the publish failure toast, keeps the dialog open, and propagates fresh issues", async () => {
    const user = userEvent.setup();
    await renderReady({ canPublish: true });
    const freshIssue: WorkflowIssue = { code: "missing_trigger", message: "This path has no Trigger.", nodeId: null, edgeId: null };
    vi.mocked(publishWorkflowAction).mockResolvedValue({ success: false, error: "Compilation failed.", issues: [freshIssue] });

    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(publishWorkflowAction).toHaveBeenCalledWith(WORKFLOW_ID);
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Compilation failed.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Validation" }));
    expect(panelContent().getByText("1 issue")).toBeInTheDocument();
    expect(panelContent().getByText("missing trigger")).toBeInTheDocument();
  });

  it("wires the toolbar Undo/Duplicate buttons to the canvas ref once history/selection state changes", async () => {
    const user = userEvent.setup();
    await renderReady();

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicate" })).toBeDisabled();

    capturedCanvasProps?.onHistoryStateChange?.({ canUndo: true, canRedo: false });
    capturedCanvasProps?.onSelectedNodeIdsChange?.(["node_1"]);

    const undoButton = await screen.findByRole("button", { name: "Undo" });
    expect(undoButton).not.toBeDisabled();
    await user.click(undoButton);
    expect(canvasMocks.undo).toHaveBeenCalled();

    const duplicateButton = screen.getByRole("button", { name: "Duplicate" });
    expect(duplicateButton).not.toBeDisabled();
    await user.click(duplicateButton);
    expect(canvasMocks.duplicateSelected).toHaveBeenCalled();
  });
});

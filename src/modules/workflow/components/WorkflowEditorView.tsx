"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Toast } from "@/components/ui/Toast";
import { Tabs, TabList, Tab } from "@/components/ui/Tabs";
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/modules/workflow/canvas/WorkflowCanvas";
import { NodeLibraryPanel } from "@/modules/workflow/components/NodeLibraryPanel";
import { PropertiesPanel } from "@/modules/workflow/components/PropertiesPanel";
import { WorkflowInspectorPanel } from "@/modules/workflow/components/WorkflowInspectorPanel";
import { ValidationPanel } from "@/modules/workflow/components/ValidationPanel";
import { SimulationPanel } from "@/modules/workflow/components/SimulationPanel";
import { VersionHistoryPanel } from "@/modules/workflow/components/VersionHistoryPanel";
import { PublishDialog } from "@/modules/workflow/components/PublishDialog";
import { getWorkflowEditorData, type WorkflowEditorData } from "@/modules/workflow/getWorkflowEditorData";
import { updateWorkflowDraft } from "@/modules/workflow/updateWorkflowDraft";
import { validateWorkflowDraft } from "@/modules/workflow/validateWorkflowDraft";
import { simulateWorkflowAction } from "@/modules/workflow/simulateWorkflowAction";
import { publishWorkflowAction } from "@/modules/workflow/publishWorkflowAction";
import { restoreWorkflowVersion } from "@/modules/workflow/restoreWorkflowVersion";
import type { WorkflowExecutionPolicy, WorkflowGraph, WorkflowIssue, WorkflowMetadata, WorkflowNodeExecutionStats, WorkflowSimulationResult, WorkflowStatus } from "@/types/workflow";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: WorkflowEditorData };
type PanelId = "properties" | "inspector" | "validation" | "simulation" | "history";
type MobilePane = "library" | "canvas" | "panel";
const AUTOSAVE_DELAY_MS = 900;
const VALIDATE_DELAY_MS = 500;

const STATUS_TONE: Record<WorkflowStatus, BadgeTone> = { draft: "outline", published: "accent", archived: "neutral" };
const STATUS_LABEL: Record<WorkflowStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };

/**
 * The Step 7 Workflow Editor — composes the Canvas (Step 8) with the Node
 * Library, Properties Panel, Workflow Inspector, Validation Panel, Version
 * History, and Publish Dialog. Owns the single source of truth for the
 * in-progress `graph`/`metadata`/`executionPolicy` while mounted; every
 * change autosaves as a draft (`updateWorkflowDraft`) and re-validates
 * (`validateWorkflowDraft`), both debounced. Publishing is the one action
 * that reaches the Automation Engine at all, and only through
 * `publishWorkflowAction` — this component never imports anything from
 * `core/automation` itself.
 */
export function WorkflowEditorView({ workflowId }: { workflowId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [metadata, setMetadata] = useState<WorkflowMetadata | null>(null);
  const [executionPolicy, setExecutionPolicy] = useState<WorkflowExecutionPolicy | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("draft");
  const [currentVersion, setCurrentVersion] = useState(0);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const [issues, setIssues] = useState<WorkflowIssue[]>([]);
  const [nodeExecutionStats, setNodeExecutionStats] = useState<Record<string, WorkflowNodeExecutionStats>>({});
  const [tab, setTab] = useState<PanelId>("properties");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [simulationResult, setSimulationResult] = useState<WorkflowSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const canvasRef = useRef<WorkflowCanvasHandle>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in sync with `graph` so the Command Palette's "Run Simulation"
  // entry — registered once, not re-registered on every edit — always
  // simulates the *current* graph rather than whatever it was when the
  // command was first registered.
  const graphRef = useRef<WorkflowGraph | null>(null);
  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    let cancelled = false;
    getWorkflowEditorData(workflowId).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error", message: result.error });
        return;
      }
      setState({ status: "ready", data: result.data });
      setGraph(result.data.workflow.graph);
      setMetadata(result.data.workflow.metadata);
      setExecutionPolicy(result.data.workflow.executionPolicy);
      setStatus(result.data.workflow.status);
      setCurrentVersion(result.data.workflow.currentVersion);
      setIssues(result.data.validation.issues);
      setNodeExecutionStats(result.data.nodeExecutionStats);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  // Step 14 Command Palette — "Publish Workflow" is contextual to *this*
  // Workflow, so it only registers while its own Editor is mounted (unlike
  // "Open Workflow Builder"/"Create Workflow"/"Recent Workflows", which
  // register from the List page instead) — the same per-page self-
  // registration pattern every other command in this codebase already uses.
  useEffect(() => {
    if (state.status !== "ready" || !state.data.canPublish) return;
    registerCommand({
      id: "publish-workflow",
      label: "Publish Workflow",
      group: "Workflows",
      keywords: ["workflow", "publish", "automation"],
      run: () => setPublishDialogOpen(true),
    });
    return () => unregisterCommand("publish-workflow");
  }, [state]);

  // Step 12's own "Run Simulation" — contextual to this Editor the same way
  // "Publish Workflow" is, registered unconditionally (unlike Publish,
  // simulating a Workflow that isn't ready to publish yet is still useful —
  // it's how an author finds out *why* not).
  useEffect(() => {
    if (state.status !== "ready") return;
    registerCommand({
      id: "run-workflow-simulation",
      label: "Run Simulation",
      group: "Workflows",
      keywords: ["workflow", "simulate", "preview", "dry run"],
      run: () => {
        setTab("simulation");
        handleRunSimulation();
      },
    });
    return () => unregisterCommand("run-workflow-simulation");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `handleRunSimulation` only closes over the stable `workflowId` prop and the current `graph` via its own closure at call time; re-registering on every graph edit would just churn the palette.
  }, [state]);

  const scheduleAutosave = useCallback(
    (nextGraph: WorkflowGraph, nextMetadata: WorkflowMetadata, nextExecutionPolicy: WorkflowExecutionPolicy) => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      setSaveState("saving");
      autosaveTimer.current = setTimeout(async () => {
        const result = await updateWorkflowDraft(workflowId, { graph: nextGraph, metadata: nextMetadata, executionPolicy: nextExecutionPolicy });
        setSaveState(result.success ? "saved" : "idle");
      }, AUTOSAVE_DELAY_MS);
    },
    [workflowId],
  );

  const scheduleValidate = useCallback(
    (nextGraph: WorkflowGraph) => {
      if (validateTimer.current) clearTimeout(validateTimer.current);
      validateTimer.current = setTimeout(async () => {
        const result = await validateWorkflowDraft(workflowId, nextGraph);
        if (result.success) setIssues(result.data.issues);
      }, VALIDATE_DELAY_MS);
    },
    [workflowId],
  );

  function handleGraphChange(nextGraph: WorkflowGraph) {
    setGraph(nextGraph);
    if (metadata && executionPolicy) scheduleAutosave(nextGraph, metadata, executionPolicy);
    scheduleValidate(nextGraph);
  }

  function handleInspectorChange(next: { metadata: WorkflowMetadata; executionPolicy: WorkflowExecutionPolicy }) {
    setMetadata(next.metadata);
    setExecutionPolicy(next.executionPolicy);
    if (graph) scheduleAutosave(graph, next.metadata, next.executionPolicy);
  }

  async function handleRunSimulation() {
    const currentGraph = graphRef.current;
    if (!currentGraph) return;
    setSimulating(true);
    const result = await simulateWorkflowAction(workflowId, currentGraph);
    setSimulating(false);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setSimulationResult(result.data);
  }

  async function handlePublish() {
    setPublishing(true);
    const result = await publishWorkflowAction(workflowId);
    setPublishing(false);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      if (result.issues) setIssues(result.issues);
      return;
    }
    setPublishDialogOpen(false);
    setStatus("published");
    setCurrentVersion(result.data.version);
    setToast({ tone: "success", message: `Published as version ${result.data.version} — ${result.data.compiledAutomationIds.length} Automation(s) registered.` });
  }

  async function handleRestore(version: number) {
    setRestoringVersion(version);
    const result = await restoreWorkflowVersion(workflowId, version);
    setRestoringVersion(null);
    if (!result.success) {
      setToast({ tone: "danger", message: result.error });
      return;
    }
    setGraph(result.data.graph);
    setMetadata(result.data.metadata);
    setExecutionPolicy(result.data.executionPolicy);
    scheduleValidate(result.data.graph);
    setToast({ tone: "success", message: `Restored version ${version} onto the current draft.` });
  }

  if (state.status === "loading" || !graph || !metadata || !executionPolicy) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} />;
  }

  const selectedNode = selectedNodeIds.length === 1 ? graph.nodes.find((node) => node.id === selectedNodeIds[0]) ?? null : null;
  const selectedNodeDefinition = selectedNode ? state.data.nodeCatalog.find((entry) => entry.id === selectedNode.nodeTypeId) ?? null : null;

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href="/workflows" className="text-sm text-text-muted transition-colors duration-150 hover:text-text">
            Workflows
          </Link>
          <span className="text-text-muted/60">/</span>
          <h2 className="font-serif text-lg font-semibold text-text">{metadata.name}</h2>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          {currentVersion > 0 ? <Badge tone="neutral">v{currentVersion}</Badge> : null}
          <span className="text-[11px] text-text-muted">{saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => canvasRef.current?.undo()} disabled={!historyState.canUndo}>
            Undo
          </Button>
          <Button type="button" variant="ghost" onClick={() => canvasRef.current?.redo()} disabled={!historyState.canRedo}>
            Redo
          </Button>
          <Button type="button" variant="ghost" onClick={() => canvasRef.current?.duplicateSelected()} disabled={selectedNodeIds.length === 0}>
            Duplicate
          </Button>
          <Button type="button" variant="ghost" onClick={() => canvasRef.current?.addAnnotation("comment")} disabled={status === "archived"}>
            Add Comment
          </Button>
          <Button type="button" variant="ghost" onClick={() => canvasRef.current?.addAnnotation("group")} disabled={status === "archived"}>
            Add Group
          </Button>
          <Button type="button" onClick={() => setPublishDialogOpen(true)} disabled={!state.data.canPublish}>
            Publish
          </Button>
        </div>
      </div>

      {/* Mobile-only pane switcher — below `lg` the three columns can't fit side by side (a visual workflow canvas is inherently a wide-screen tool), so one pane shows at a time instead of squeezing the canvas to nothing. */}
      <Tabs value={mobilePane} onValueChange={(next) => setMobilePane(next as MobilePane)} className="pt-2 lg:hidden">
        <TabList aria-label="Editor pane">
          <Tab value="library">Nodes</Tab>
          <Tab value="canvas">Canvas</Tab>
          <Tab value="panel">Panel</Tab>
        </TabList>
      </Tabs>

      <div className="flex min-h-0 flex-1 gap-3 pt-3">
        <div className={`${mobilePane === "library" ? "flex" : "hidden"} w-full shrink-0 overflow-hidden rounded-md border border-border lg:flex lg:w-56`}>
          <NodeLibraryPanel nodeCatalog={state.data.nodeCatalog} onAddNode={(nodeTypeId) => {
            const definition = state.data.nodeCatalog.find((entry) => entry.id === nodeTypeId);
            if (definition) canvasRef.current?.addNode(definition);
          }} />
        </div>

        <div className={`${mobilePane === "canvas" ? "block" : "hidden"} min-w-0 flex-1 overflow-hidden rounded-md border border-border lg:block`}>
          <WorkflowCanvas
            ref={canvasRef}
            graph={graph}
            nodeCatalog={state.data.nodeCatalog}
            onGraphChange={handleGraphChange}
            onSelectedNodeIdsChange={setSelectedNodeIds}
            onHistoryStateChange={setHistoryState}
            readOnly={status === "archived"}
            nodeExecutionStats={nodeExecutionStats}
            issues={issues}
          />
        </div>

        <div className={`${mobilePane === "panel" ? "flex" : "hidden"} w-full shrink-0 flex-col overflow-hidden rounded-md border border-border lg:flex lg:w-72`}>
          <Tabs value={tab} onValueChange={(next) => setTab(next as PanelId)}>
            <TabList aria-label="Workflow editor panels" className="px-1">
              <Tab value="properties">Properties</Tab>
              <Tab value="inspector">Inspector</Tab>
              <Tab value="validation">Validation</Tab>
              <Tab value="simulation">Simulation</Tab>
              <Tab value="history">Versions</Tab>
            </TabList>
          </Tabs>
          <div className="h-full overflow-y-auto">
            {tab === "properties" ? (
              <PropertiesPanel
                selectedNode={selectedNode}
                nodeDefinition={selectedNodeDefinition}
                onUpdateNodeData={(nodeId, data) => canvasRef.current?.updateNodeData(nodeId, data)}
              />
            ) : null}
            {tab === "inspector" ? <WorkflowInspectorPanel metadata={metadata} executionPolicy={executionPolicy} onChange={handleInspectorChange} /> : null}
            {tab === "validation" ? <ValidationPanel issues={issues} onSelectNode={(nodeId) => setSelectedNodeIds([nodeId])} /> : null}
            {tab === "simulation" ? <SimulationPanel result={simulationResult} running={simulating} onRun={handleRunSimulation} /> : null}
            {tab === "history" ? <VersionHistoryPanel versions={state.data.versions} restoringVersion={restoringVersion} onRestore={handleRestore} /> : null}
          </div>
        </div>
      </div>

      <PublishDialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} issues={issues} publishing={publishing} onConfirm={handlePublish} currentVersion={currentVersion} />

      {toast ? <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}

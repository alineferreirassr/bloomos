import type { Workflow, WorkflowExecutionPolicy, WorkflowGraph, WorkflowMetadata, WorkflowVersion } from "@/types/workflow";
import type { DataResult } from "@/lib/data/result";

export interface CreateWorkflowInput {
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
  graph: WorkflowGraph;
}

export interface UpdateWorkflowDraftInput {
  metadata?: WorkflowMetadata;
  executionPolicy?: WorkflowExecutionPolicy;
  graph?: WorkflowGraph;
}

export interface RecordPublishedVersionInput {
  graph: WorkflowGraph;
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
  compiledAutomationIds: string[];
  publishedBy: string;
}

/**
 * The Step 6 Workflow Storage contract. "Never mutate published versions"
 * is enforced by this interface's own shape, not by convention: there is no
 * `updateVersion`/`deleteVersion` method anywhere on it — a `WorkflowVersion`
 * can only ever be created (`recordPublishedVersion`), matching the
 * Automation History's own append-only precedent (`AutomationRepository`).
 * `restoreWorkflowVersion` only ever writes to the mutable `Workflow.graph`
 * draft, never to the version record it reads from.
 */
export interface WorkflowRepository {
  createWorkflow(workspaceId: string, createdBy: string, input: CreateWorkflowInput): Promise<DataResult<Workflow>>;
  getWorkflowById(id: string): Promise<Workflow | null>;
  listWorkflows(workspaceId: string): Promise<Workflow[]>;
  updateWorkflowDraft(id: string, input: UpdateWorkflowDraftInput): Promise<DataResult<Workflow>>;
  archiveWorkflow(id: string): Promise<DataResult<Workflow>>;
  unarchiveWorkflow(id: string): Promise<DataResult<Workflow>>;
  /** Creates a brand-new Workflow (its own id, `status: "draft"`, `currentVersion: 0`) copying the source's current draft `graph`/`metadata`/`executionPolicy` — the source Workflow, and its own published versions, are untouched. */
  cloneWorkflow(id: string, createdBy: string): Promise<DataResult<Workflow>>;
  /** Creates the next immutable `WorkflowVersion` and flips the Workflow's own `status` to `"published"`/`currentVersion` forward — called only by `publishWorkflow()` (Step 10), after a successful compile. */
  recordPublishedVersion(workflowId: string, input: RecordPublishedVersionInput): Promise<DataResult<WorkflowVersion>>;
  getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]>;
  getWorkflowVersion(workflowId: string, version: number): Promise<WorkflowVersion | null>;
  /** Copies a prior version's own `graph`/`metadata`/`executionPolicy` back onto the Workflow's own current draft — a discard-current-edits operation. Never touches the `WorkflowVersion` record itself, and never changes `status`/`currentVersion`. */
  restoreWorkflowVersion(workflowId: string, version: number): Promise<DataResult<Workflow>>;
}

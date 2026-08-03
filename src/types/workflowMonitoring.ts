import type { EntityType } from "@/core/enums/entityType";
import type { AutomationActionExecutionResult, AutomationExecutionStatus, AutomationTriggerType, WorkflowScheduleFrequency } from "@/types/automation";
import type { WorkflowIssue, WorkflowStatus } from "@/types/workflow";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Workflow Monitoring Center. Every
 * type here is a read-model over data that already exists: real
 * `AutomationExecution` records (Automation History, `core/automation/`),
 * the real Automation Registry, and the real Workflow store. Nothing here
 * introduces a second execution model, a second health calculation, or a
 * second audit log — see each engine's own doc comment in
 * `core/workflowMonitoring/` for the exact source it composes.
 */

/**
 * The six buckets the Live Execution Monitor groups by. BloomOS's
 * Automation Engine (`core/automation/resolver.ts`) is fully synchronous —
 * `executeAutomation()` blocks until every action has run, and the result
 * is already persisted by the time any caller can observe it — so there is
 * no real "currently executing" state to read. `"running"` is kept as an
 * honest, always-empty bucket (never fabricated) rather than silently
 * dropped, since the addendum names it explicitly; `"waiting"` maps onto
 * the one real paused state the engine has (`pending_approval`);
 * `"cancelled"` maps onto a rejected approval (`rejected`); `"skipped"`
 * (skipped by its own conditions) is kept as its own honest bucket rather
 * than folded into "cancelled," since it's a materially different real
 * status. `"scheduled"` is not an execution at all — see
 * `WorkflowScheduledSummary` below.
 */
export const WORKFLOW_EXECUTION_BUCKETS = ["running", "waiting", "failed", "successful", "cancelled", "skipped"] as const;
export type WorkflowExecutionBucket = (typeof WORKFLOW_EXECUTION_BUCKETS)[number];

export interface WorkflowExecutionEntityRef {
  type: EntityType;
  id: string;
}

/**
 * One row in the Live Execution Monitor / Execution History — a real
 * `AutomationExecution` joined with the Workflow it belongs to (via the
 * compiled Automation's own `metadata.workflowId`/`sourceNodeIds`, written
 * by `core/workflow/compiler.ts`) and the entity it acted on (the first
 * action result carrying a `resultRef`).
 */
export interface WorkflowExecutionSummary {
  executionId: string;
  workflowId: string | null;
  workflowName: string;
  workflowVersion: string;
  bucket: WorkflowExecutionBucket;
  status: AutomationExecutionStatus;
  trigger: AutomationTriggerType;
  /** Every node id the compiled path this execution ran belongs to, in path order — `[]` when the Automation this execution ran through wasn't compiled from a Workflow (a hand-registered Automation has no `sourceNodeIds`). */
  executionPath: string[];
  /** The last node id in `executionPath` this execution actually reached — `null` when it never reached the action stage (denied by permission/role/feature-flag, or skipped by its own conditions). */
  currentNodeId: string | null;
  entity: WorkflowExecutionEntityRef | null;
  startedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number;
  actionResults: AutomationActionExecutionResult[];
}

/**
 * A Workflow with a configured `executionPolicy.scheduledExecution` —
 * configuration, never a live queued execution, since BloomOS has no
 * background scheduler to actually fire one (the same disclosed gap
 * `WorkflowScheduledExecution`'s own doc comment in `types/automation.ts`
 * already names).
 */
export interface WorkflowScheduledSummary {
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  frequency: WorkflowScheduleFrequency;
  time: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}

/**
 * One workflow error, derived from a `failure`/`partial_failure`
 * `AutomationExecution`'s own `actionResults` — one record per failed
 * action, never a second failure-logging store. `stack` is honestly the
 * action's own structured `message`: the Action Runner
 * (`core/automation/actionRunner.ts`) never throws and never captures a
 * JS stack trace, it returns a typed failure result, so that message is
 * the only real diagnostic text that exists for a failed action.
 */
export interface WorkflowErrorRecord {
  executionId: string;
  workflowId: string | null;
  workflowName: string;
  actionId: string;
  stack: string;
  entity: WorkflowExecutionEntityRef | null;
  /** `attempts - 1` from the same `AutomationActionExecutionResult` — how many retries the Action Runner's own `maxRetries` loop already made before this execution was recorded. */
  retryCount: number;
  occurredAt: string;
}

export interface WorkflowDurationRanking {
  workflowId: string;
  workflowName: string;
  averageDurationMs: number;
}

export interface WorkflowExecutionFrequency {
  workflowId: string;
  workflowName: string;
  executionCount: number;
}

/**
 * v2.0 Checkpoint 39 addendum — merges the original Checkpoint 39 Task
 * #731 "Workflow Analytics engine." Every field is aggregated straight
 * from Automation History + the Automation Registry, mirroring the exact
 * join `core/workflow/nodeExecutionStats.ts` already established for
 * per-node stats — this is that same join, summarized workspace-wide.
 */
export interface WorkflowPerformanceMetrics {
  averageExecutionDurationMs: number | null;
  slowestWorkflows: WorkflowDurationRanking[];
  fastestWorkflows: WorkflowDurationRanking[];
  mostExecutedWorkflows: WorkflowExecutionFrequency[];
  failedExecutionCount: number;
  /** `success` executions ÷ total executions × 100, rounded — `null` when there have been zero executions yet. */
  successRate: number | null;
  /** Average of `approvedAt`/`rejectedAt` minus `startedAt` across every execution that ever reached `pending_approval` — `null` when none have. */
  averageWaitTimeMs: number | null;
  nodeExecutionFrequency: Record<string, number>;
  actionExecutionFrequency: Record<string, number>;
  triggerFrequency: Partial<Record<AutomationTriggerType, number>>;
  evaluatedAt: string;
}

/** One workflow whose compiled Automation's own action chain includes an action that produces a real trigger type another workflow (or itself) listens for — a real dependency, derived from already-registered Automation Definitions, never a live Knowledge Graph write. */
export interface WorkflowTriggerEdge {
  sourceWorkflowId: string;
  sourceWorkflowName: string;
  producedTrigger: AutomationTriggerType;
  targetWorkflowIds: string[];
}

/**
 * v2.0 Checkpoint 39 addendum — "workflows triggering workflows,"
 * "circular references," "dependency chains," "trigger graph," "action
 * graph." Computed entirely from the already-registered Automation
 * Registry (`core/automation/registry.ts`) and the Workflow store — no
 * new Knowledge Graph writes, since no call site currently registers a
 * Workflow/Automation KG node (confirmed by audit; `"workflow"`/
 * `"automation"` are real `KnowledgeNodeType`s but unused today). Wiring
 * live KG relationships for this map is a disclosed future extension, not
 * done here, to avoid touching the dozens of real dispatch call sites
 * this checkpoint didn't otherwise need to change.
 */
export interface WorkflowDependencyMap {
  triggerGraph: Partial<Record<AutomationTriggerType, string[]>>;
  actionGraph: Record<string, string[]>;
  workflowsTriggeringWorkflows: WorkflowTriggerEdge[];
  circularChains: string[][];
  evaluatedAt: string;
}

/**
 * Findings the real `validateWorkflow()`/`analyzeWorkflowGraph()` don't
 * already cover — see each engine's own doc comment in
 * `core/workflowMonitoring/healthEngine.ts` for exactly which of the
 * addendum's ten checks map onto an existing `WorkflowIssueCode` instead
 * of one of these.
 */
export const WORKFLOW_HEALTH_FINDING_CODES = ["dead_branch", "duplicated_action", "duplicated_condition", "unused_workflow", "disabled_workflow", "archived_workflow"] as const;
export type WorkflowHealthFindingCode = (typeof WORKFLOW_HEALTH_FINDING_CODES)[number];

export interface WorkflowHealthFinding {
  code: WorkflowHealthFindingCode;
  message: string;
  nodeId: string | null;
}

/**
 * Merges the original Checkpoint 39 Task #732 "Workflow Health engine."
 * `structuralIssues` is never re-detected — it's the exact `WorkflowIssue[]`
 * `validateWorkflow(workflow.graph).issues` already returns, since that
 * validator already covers unreachable nodes, missing/invalid triggers,
 * and missing actions.
 */
export interface WorkflowHealthReport {
  workflowId: string;
  workflowName: string;
  status: WorkflowStatus;
  structuralIssues: WorkflowIssue[];
  findings: WorkflowHealthFinding[];
  /** 100 minus a penalty per issue/finding, floored at 0 — the same `categoryFromRatio`-style scoring convention `core/knowledge/businessHealthEngine.ts` already uses. */
  score: number;
  evaluatedAt: string;
}

export interface WorkspaceWorkflowHealthSummary {
  reports: WorkflowHealthReport[];
  /** `null` when the workspace has no workflows yet — an honest empty state, never a fabricated 100. */
  averageScore: number | null;
  totalFindings: number;
  evaluatedAt: string;
}

/**
 * v2.0 Checkpoint 39 addendum — "Workflow Audit." A pure read-model over
 * one `AutomationExecution`, never a second write path: that record is
 * already immutable and append-only (see its own doc comment in
 * `types/automation.ts`), which already satisfies "every workflow
 * execution should produce an immutable audit record."
 */
export interface WorkflowAuditRecord {
  executionId: string;
  workflowId: string | null;
  workflowName: string;
  versionExecuted: string;
  inputs: Record<string, string | number | boolean | null>;
  outputs: AutomationActionExecutionResult[];
  durationMs: number;
  nodePath: string[];
  actor: string;
  timestamp: string;
}

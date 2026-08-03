import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { AutomationCategory, AutomationDefinition, AutomationExecutionStatus, WorkflowScheduledExecution } from "@/types/automation";

export type { WorkflowScheduledExecution, WorkflowScheduleFrequency } from "@/types/automation";
export { WORKFLOW_SCHEDULE_FREQUENCIES } from "@/types/automation";

/**
 * Checkpoint 10 — the Workflow Builder's own domain. This file is
 * deliberately framework-agnostic: nothing here imports React, `@xyflow/react`,
 * or any rendering concern — the same "core stays server-safe" discipline
 * `types/automation.ts` already established. The Visual Editor (Step 7/8)
 * renders these types; it never redefines them.
 *
 * A Workflow **designs** an Automation. It never runs one — publishing a
 * Workflow compiles its graph into one or more real `AutomationDefinition`s
 * (see `core/workflow/compiler.ts`) and registers them the same way any
 * hand-written `registerAutomation()` call would. From that point on, the
 * Automation Engine (Checkpoint 9) owns execution entirely; the Workflow
 * Builder never calls `executeAutomation()` or `dispatchAutomationTrigger()`.
 */

/**
 * The structural role a node plays in the graph — closed, the same "small
 * curated set" bias `AUTOMATION_TRIGGER_TYPES` already uses, since a graph's
 * own shape rules (Start has no incoming edge, End has no outgoing edge,
 * exactly one Start per Workflow) are written against this set, not against
 * the open Node Registry (see `WorkflowNodeDefinition` below). Adding a new
 * *kind* is a rare, deliberate graph-model change; adding a new *node type*
 * (e.g. a new concrete Trigger) is Step 3's own everyday, registry-driven
 * extension point and never touches this enum.
 */
export const WORKFLOW_NODE_KINDS = ["start", "trigger", "condition", "approval", "action", "end"] as const;
export type WorkflowNodeKind = (typeof WORKFLOW_NODE_KINDS)[number];

/** A 2D canvas position — plain data, never a React Flow `XYPosition` import, so the graph model itself never depends on the rendering library. */
export interface WorkflowPosition {
  x: number;
  y: number;
}

/**
 * One instance of a node type on the canvas. `nodeTypeId` points into the
 * open, registry-based `WorkflowNodeDefinition` catalog (Step 3) — this is
 * the same closed-kind/open-type split `types/automation.ts` already uses
 * between `AutomationTriggerType` (closed) and `AutomationActionDefinition.id`
 * (open). `data` is the node's own configuration — e.g. a Condition node's
 * `{field, operator, value}`, an Approval node's `{minimumApproverRole}` —
 * validated by that node type's own `WorkflowNodeDefinition.validate`, never
 * given a fixed shape here since every node type's own configuration differs.
 */
export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  nodeTypeId: string;
  position: WorkflowPosition;
  label: string;
  data: Record<string, string | number | boolean | null>;
}

/**
 * `branch` distinguishes a Condition node's two outgoing paths — `null` for
 * every other node kind, whose own single outgoing edge is unambiguous. Kept
 * as a closed boolean-shaped set rather than an open string so the Compiler
 * (Step 4) and Validation Engine (Step 5) can exhaustively reason about
 * "does this Condition node have both branches wired."
 */
export type WorkflowEdgeBranch = "true" | "false" | null;

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  branch: WorkflowEdgeBranch;
}

/**
 * A workflow-scoped named value a node's own `data` may reference (e.g. a
 * Condition comparing against a variable rather than a literal). Explicitly
 * NOT a loop-iteration or runtime-mutable variable — per this checkpoint's
 * own non-goals (no loops, no timers, no delays), a `WorkflowVariable` is a
 * static, author-time declaration only; nothing in the compiled Automation
 * Definition ever writes back to one.
 */
export const WORKFLOW_VARIABLE_TYPES = ["string", "number", "boolean"] as const;
export type WorkflowVariableType = (typeof WORKFLOW_VARIABLE_TYPES)[number];

export interface WorkflowVariable {
  key: string;
  label: string;
  type: WorkflowVariableType;
  description: string | null;
}

export interface WorkflowMetadata {
  name: string;
  description: string;
  category: AutomationCategory;
  tags: string[];
}

/**
 * Workflow-level execution settings the Compiler copies onto every
 * `AutomationDefinition` it produces from this Workflow's graph — kept at
 * the Workflow level, not per-node, since a single Workflow always compiles
 * to Automations that share one permission/role/feature-flag/retry posture.
 * Node-level Approval configuration (who may approve) is a separate,
 * per-node concern (`WorkflowNode.data` on an Approval node) — this is
 * "may this Workflow run at all," not "who signs off on one step of it."
 */
export interface WorkflowExecutionPolicy {
  requiredPermissions: Permission[];
  minimumRole: WorkspaceMemberRole | null;
  featureFlag: string | null;
  /** Mirrors `AutomationDefinition.maxRetries` — copied onto every compiled Automation. */
  maxRetries: number;
  /**
   * v2.0 Checkpoint 39 — "Scheduled Workflows." `null` means this Workflow
   * only runs from its own graph's real Trigger node(s), same as every
   * Workflow before this checkpoint. Copied onto every compiled
   * Automation's own `workflow.scheduledExecution` the same way
   * `maxRetries` already is — see `WorkflowScheduledExecution`'s own doc
   * comment (`types/automation.ts`) for the disclosed execution gap.
   */
  scheduledExecution: WorkflowScheduledExecution | null;
}

export const WORKFLOW_ANNOTATION_KINDS = ["comment", "group"] as const;
export type WorkflowAnnotationKind = (typeof WORKFLOW_ANNOTATION_KINDS)[number];

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — a purely visual canvas
 * annotation: a sticky-note "comment" or a labeled "group" frame an author
 * draws around related nodes to organize a large graph. Optional and
 * additive on `WorkflowGraph` on purpose — the Compiler, Validation Engine,
 * and Simulator all read only `nodes`/`edges`/`variables` and never this
 * field, so annotations can never affect what a Workflow compiles to, how
 * it validates, or how it simulates. Every pre-Checkpoint-39
 * Workflow/Template/fixture stays valid with no `annotations` field at all.
 * A "group" is a visual frame only — it does not reparent the nodes drawn
 * inside it; dragging the frame moves the frame, not its contents.
 */
export interface WorkflowAnnotation {
  id: string;
  kind: WorkflowAnnotationKind;
  position: WorkflowPosition;
  size: { width: number; height: number };
  text: string;
  /** A design-token color name, same convention as `WorkflowNodeDefinition.color`. */
  color: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariable[];
  annotations?: WorkflowAnnotation[];
}

export const WORKFLOW_STATUSES = ["draft", "published", "archived"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

/**
 * The Step 1 "Workflow" — the mutable, editable entity a Workflow Editor
 * session works against. `graph` is always the **current, possibly-unpublished**
 * working copy; a published, immutable snapshot lives separately as a
 * `WorkflowVersion` (Step 11 — see below). `currentVersion` is `0` for a
 * Workflow that has never been published.
 */
export interface Workflow {
  id: string;
  workspaceId: string;
  status: WorkflowStatus;
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
  graph: WorkflowGraph;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/**
 * The Step 11 "immutable version" — a frozen snapshot created by exactly
 * one code path, `publishWorkflow()` (see `core/workflow/manager.ts`).
 * Never mutated after creation — restoring an old version (Step 11's own
 * "Restore") copies a version's own `graph`/`metadata`/`executionPolicy`
 * back onto the Workflow's own *draft* `graph`, it never edits the version
 * record itself, preserving the append-only version history.
 */
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  workspaceId: string;
  version: number;
  graph: WorkflowGraph;
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
  /** The real `AutomationDefinition.id`s this version compiled into and registered — the Step 13 Dashboard's own "Execution Links"/"Automation Usage" read straight off this list, never a separate mapping table. */
  compiledAutomationIds: string[];
  publishedBy: string;
  publishedAt: string;
}

/**
 * The Step 3/17 Node Registry's own declaration — deliberately the open,
 * registry-based counterpart to `WorkflowNodeKind`'s closed set, the same
 * split `AutomationTriggerType` (closed) vs. `AutomationActionDefinition`
 * (open) already establishes. "Future node types must register
 * automatically" (Step 2) and "No hardcoded node rendering" (Step 3) are
 * both satisfied by this being the *only* place a node type's identity,
 * icon, color, and validation live — the Node Library UI and the
 * NodeRenderer both read this catalog, never a hand-maintained switch
 * statement.
 */
export const WORKFLOW_NODE_CATEGORIES = ["control", "trigger", "condition", "approval", "action"] as const;
export type WorkflowNodeCategory = (typeof WORKFLOW_NODE_CATEGORIES)[number];

/**
 * Checkpoint 13 — three reserved `compileTarget` sentinels for the generic
 * Condition nodes (If/Compare/Exists/Switch). Every Step 9 Condition node
 * from Checkpoint 10 is fixed to one `AutomationConditionField` baked
 * directly into `compileTarget`; these four are field-agnostic instead —
 * the member picks which of `AUTOMATION_CONDITION_FIELDS` to branch on
 * per node *instance*, stored in that instance's own `data.field`. The
 * Compiler (`conditionFromNode` in `core/workflow/compiler.ts`) checks for
 * these three sentinels before falling back to its original
 * "`compileTarget` names the field directly" path, so every one of
 * Checkpoint 10's own 6 fixed Condition nodes keeps compiling exactly as
 * before.
 */
export const DYNAMIC_CONDITION_FIELD_TARGET = "dynamic:field";
export const DYNAMIC_CONDITION_EXISTS_TARGET = "dynamic:exists";
export const DYNAMIC_CONDITION_SWITCH_TARGET = "dynamic:switch";

export interface WorkflowNodeValidationContext {
  node: WorkflowNode;
  graph: WorkflowGraph;
}

export interface WorkflowNodeDefinition {
  id: string;
  kind: WorkflowNodeKind;
  category: WorkflowNodeCategory;
  name: string;
  description: string;
  /** A name from the fixed icon lookup map the Node Library/NodeRenderer resolve against (`modules/workflow/canvas/nodeIcons.ts`) — a string, never a React component reference, keeping this declaration importable from server code. */
  icon: string;
  /** A design-token color name (e.g. `"accent"`, `"danger"`) — never a raw hex baked into the registry, so both themes stay consistent automatically. */
  color: string;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  /**
   * What this node type compiles to. A Trigger node names an
   * `AutomationTriggerType`; an Action node names an
   * `AutomationActionDefinition.id`; an Approval node names an
   * `ApprovalPolicyKind`; a Condition node names the one
   * `AutomationConditionField` it's fixed to (each of the Step 9 Condition
   * node types — Role, Feature Flag, Workspace, Invoice Amount, Proposal
   * Value, Days Overdue — is its own registered node type with the field
   * baked in here; only `operator`/`value` live in the node instance's own
   * `data`). `null` only for Start/End, which are purely structural.
   */
  compileTarget: string | null;
  /** Validates one node instance's own `data` ahead of compilation — returns a human-readable problem, or `null` when the node is well-formed. Absence means "this node type has no configuration to validate" (e.g. Start/End). */
  validate?: (context: WorkflowNodeValidationContext) => string | null;
}

/**
 * Every problem code either the Compiler (Step 4 — structural, graph-shape
 * issues that make compilation itself impossible) or the Validation Engine
 * (Step 5 — business-semantic issues checked only before publish, never at
 * runtime) can raise. Deliberately one shared closed set rather than two,
 * since `"invalid_graph"` (Validation Engine) is explicitly a wrapper around
 * whichever structural code the shared graph-analysis pass already found —
 * see `core/workflow/graphAnalysis.ts`.
 */
export const WORKFLOW_ISSUE_CODES = [
  // Structural — Step 4, raised by graphAnalysis.ts, block compilation outright.
  "cycle_detected",
  "missing_node",
  "invalid_edge",
  "duplicate_id",
  "unreachable_node",
  "unsupported_transition",
  // Semantic — Step 5, checked only by validateWorkflow() before publishing.
  "missing_trigger",
  "missing_action",
  "orphan_node",
  "duplicate_variable",
  "approval_loop",
  "invalid_graph",
  "invalid_node_configuration",
] as const;
export type WorkflowIssueCode = (typeof WORKFLOW_ISSUE_CODES)[number];

export interface WorkflowIssue {
  code: WorkflowIssueCode;
  message: string;
  nodeId: string | null;
  edgeId: string | null;
}

export type WorkflowCompilationResult = { success: true; automations: AutomationDefinition[] } | { success: false; issues: WorkflowIssue[] };

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — real per-node execution
 * stats for the Canvas's own status overlay, aggregated from Automation
 * History (`core/automation/manager.ts`) rather than a new tracking
 * engine: every compiled Automation's own `metadata.sourceNodeIds`
 * (`core/workflow/compiler.ts`) already names which graph nodes a given
 * execution belongs to. `null` fields mean "never executed" — a real,
 * honest empty state, never a fabricated zero.
 */
export interface WorkflowNodeExecutionStats {
  executionCount: number;
  lastStatus: AutomationExecutionStatus | null;
  lastExecutedAt: string | null;
  averageDurationMs: number | null;
}

export interface WorkflowValidationResult {
  valid: boolean;
  issues: WorkflowIssue[];
}

/**
 * Step 7 — a built-in Workflow Template: a ready-made starting `graph` a
 * member can create a new Workflow from instead of an empty canvas, same
 * spirit as `WorkflowNodeDefinition` — a small, open `Map`-based registry
 * (`core/workflow/templateRegistry.ts`), never a hardcoded array baked
 * into the "New Workflow" dialog. Every built-in Template's own `graph` is
 * built entirely from real, already-registered node types — a Template
 * never introduces a new kind of step, it only arranges existing ones,
 * mirroring the Workflow Builder's own top-level "compose, don't
 * implement" principle one level up.
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  graph: WorkflowGraph;
}

/**
 * Step 6 — the Execution Simulator's own preview types. A `WorkflowSimulationStep`
 * mirrors one real node the Compiler would visit while producing a
 * `CompiledPath`, but describes what *would* happen in plain language —
 * nothing here ever calls a real Action, Skill, or Automation. `preview`
 * always derives from the same `compileTarget`/`conditionFromNode`
 * resolution the real Compiler uses (see `core/workflow/simulator.ts`), so
 * a Simulation can never show a step the Compiler itself wouldn't produce.
 */
export interface WorkflowSimulationStep {
  nodeId: string;
  kind: WorkflowNodeKind;
  name: string;
  /** A human-readable description of what this step does or would branch on — never a real side effect. */
  preview: string;
  /** Set only when this step was reached by taking a Condition node's branch. */
  branch: "true" | "false" | null;
}

export interface WorkflowSimulationPath {
  triggerNodeId: string;
  triggerName: string;
  steps: WorkflowSimulationStep[];
  /** Mirrors `CompiledPath.actionIds.length` — how many real Actions this path would run if it were a real, dispatched Automation. */
  actionCount: number;
}

export interface WorkflowSimulationResult {
  valid: boolean;
  issues: WorkflowIssue[];
  paths: WorkflowSimulationPath[];
  nodeCount: number;
  triggerCount: number;
  /** A coarse, workspace-level, read-only Memory summary — populated only when at least one simulated path touches a Memory-related node (Step 11's own "read memory," never bypassing Memory's own policies since it's the real `summarizeMemories()` read path). `null` when no path touches Memory, or the caller didn't request it. */
  memoryPreview: { approvedCount: number; pendingCount: number } | null;
}

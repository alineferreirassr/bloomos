import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { ExecutionPriority } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 29 — Field Operations Platform. Dispatch (28) assigns
 * work. Field Operations manages and tracks EXECUTION STATE ONLY — it
 * never executes work itself in any physical sense, never captures GPS,
 * never optimizes routes, never performs live monitoring, no AI. Every
 * engine in this domain is a pure, deterministic function; no randomness.
 *
 * Three-tier aggregate, the same shape Dispatch's own Order/Assignment/
 * Attempt established: `FieldOperation` (one per Dispatch Assignment,
 * a coarse shell status) → `ExecutionSession[]` (one run of execution;
 * more than one only if a prior session was cancelled/aborted and the
 * work restarted) → `ExecutionAttempt[]` (the atomic transition log,
 * mirrors `DispatchAttempt` exactly). The spec's own Step 3 line —
 * "Sessions belong to one Dispatch Assignment" — holds transitively:
 * every session belongs to the one `FieldOperation` that itself maps
 * 1:1 to a Dispatch Assignment.
 *
 * Naming collisions, disclosed and resolved: the spec's own Step 1 names
 * "Execution Priority" and "Execution Context" as domain nouns, but
 * `types/executionPackage.ts` already exports `ExecutionPriority` (an
 * `AppointmentPriority` alias) and `ExecutionContext` (a package's own
 * context/customer/location/priority bundle) — both real, unrelated
 * concepts from Checkpoint 27.3. Rather than shadow either:
 * - "Execution Priority" reuses the existing `ExecutionPriority` type
 *   directly, exactly like `DispatchPriority = ExecutionPriority` did
 *   before it — a session's priority is the same concept as the
 *   Dispatch Order/Execution Package it's executing, never re-declared.
 * - "Execution Context" is satisfied by a plain `KnowledgeNodeRef | null`
 *   field on `FieldOperation` — the same shape every other context
 *   reference in this codebase already uses, never a reinvented struct;
 *   naming a new `FieldOperationContext` interface around one nullable
 *   ref would be pure ceremony.
 * The spec's own Step 1 line also names "Execution Status" separately
 * from "Execution State" (Step 5's own computed engine). Read as two
 * distinct concepts — the raw lifecycle value or the derived snapshot —
 * "Execution Status" is satisfied here by `ExecutionLifecycleState`
 * (renamed only to dodge `executionPackage.ts`'s own `ExecutionStatus`,
 * a different concept — a package's own draft/validated/approved/
 * archived approval status). "Execution State" needed no rename; it's
 * declared below as-is.
 */

// ---- Field Operation shell ----

export const FIELD_OPERATION_STATUSES = ["active", "completed", "cancelled", "archived"] as const;
export type FieldOperationStatus = (typeof FIELD_OPERATION_STATUSES)[number];

export interface FieldOperation {
  id: string;
  workspace_id: string;
  /** The Dispatch Order this operation's work came from — pinned, never re-resolved. */
  dispatch_order_id: string;
  /** The one Dispatch Assignment this Field Operation exists for. */
  dispatch_assignment_id: string;
  execution_package_id: string;
  /** The exact immutable `ExecutionVersion` this operation executes against. */
  execution_version_id: string;
  priority: ExecutionPriority;
  /** Reused from the source Execution Package's own `ExecutionContext.context` — never re-resolved independently. */
  context: KnowledgeNodeRef | null;
  status: FieldOperationStatus;
  sessions: ExecutionSession[];
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---- Execution Lifecycle (Step 2) — the spec's own 10 named states ----

/**
 * Real precedence: `created` (session opened) → `waiting` (validated,
 * queued to start) → `started` → `paused` ⇄ `resumed` (a session may
 * cycle through these while active work continues) → one of
 * `completed`/`cancelled`/`aborted`/`failed` (terminal) → `archived`
 * (a terminal session put away). `aborted` is distinct from `cancelled` —
 * cancelled is a deliberate stop before/soon after starting; aborted is
 * an emergency stop of already-in-progress work.
 */
export const EXECUTION_LIFECYCLE_STATES = ["created", "waiting", "started", "paused", "resumed", "completed", "cancelled", "aborted", "failed", "archived"] as const;
export type ExecutionLifecycleState = (typeof EXECUTION_LIFECYCLE_STATES)[number];

export const EXECUTION_OUTCOMES = ["completed", "cancelled", "aborted", "failed"] as const;
export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];

/** One transition record — the atomic entry a session's own transition history is built from, the exact `DispatchAttempt` precedent. */
export interface ExecutionAttempt {
  id: string;
  session_id: string;
  lifecycle_state: ExecutionLifecycleState;
  reason: string | null;
  created_at: string;
}

export interface ExecutionSession {
  id: string;
  field_operation_id: string;
  lifecycle_state: ExecutionLifecycleState;
  /** Set only once `lifecycle_state` reaches a terminal value (`completed`/`cancelled`/`aborted`/`failed`); `null` otherwise. */
  outcome: ExecutionOutcome | null;
  /** The latest cancel/abort/fail reason, when one was given. */
  reason: string | null;
  /** Points at one of the frozen `ExecutionSnapshot.phases` entries — the live overlay this session tracks on top of read-only plan data. */
  current_phase_id: string | null;
  /** Live overlays — which frozen `ExecutionStep`/`Milestone`/`ChecklistItemDefinition`/`Deliverable` ids this session has actually completed. The plan's own frozen statuses never change; execution progress is tracked here instead. */
  completed_step_ids: string[];
  completed_milestone_ids: string[];
  completed_checklist_item_ids: string[];
  completed_deliverable_ids: string[];
  started_at: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  attempts: ExecutionAttempt[];
}

// ---- Computed results (never stored) ----

export interface ExecutionValidationIssue {
  rule: string;
  detail: string;
}

export interface ExecutionValidationResult {
  valid: boolean;
  errors: ExecutionValidationIssue[];
  warnings: ExecutionValidationIssue[];
}

/** Every real-world fact `ExecutionValidationEngine` needs but cannot resolve itself — the caller reads live Dispatch/Package/Assignment state and hands it in as plain booleans. */
export interface ExecutionValidationInput {
  dispatchAccepted: boolean;
  packageApproved: boolean;
  workerAssigned: boolean;
  requiredResourcesPresent: boolean;
  operationalPlanExists: boolean;
  assignmentActive: boolean;
}

export interface ExecutionState {
  currentState: ExecutionLifecycleState;
  previousState: ExecutionLifecycleState | null;
  transitionHistory: ExecutionAttempt[];
  elapsedTimeSeconds: number;
  pauseDurationSeconds: number;
  executionDurationSeconds: number;
  /** `null` until the session reaches `completed`. */
  completionDurationSeconds: number | null;
}

export interface ExecutionHealthScores {
  executionHealth: number;
  progressHealth: number;
  pauseHealth: number;
  completionHealth: number;
  lifecycleHealth: number;
  overallOperationalHealth: number;
}

export interface ExecutionExplanation {
  summary: string;
  whyCannotStart: string[];
  whyPaused: string[];
  whyResumed: string[];
  whyFailed: string[];
  whyCompletionRejected: string[];
  healthSummary: string;
}

export interface OperationalProgress {
  currentPhaseId: string | null;
  completedStepIds: string[];
  remainingStepIds: string[];
  completedMilestoneIds: string[];
  pendingMilestoneIds: string[];
  /** 0-100 — completed checklist items ÷ total items across every frozen `PlanChecklist`. */
  checklistProgress: number;
  /** 0-100 — `delivered` deliverables ÷ total frozen `Deliverable`s. */
  deliverableProgress: number;
  /** Always `null` — the spec's own "Evidence Progress Placeholder" line; no evidence capture this checkpoint. */
  evidenceProgressPlaceholder: null;
}

export interface ExecutionResult {
  fieldOperation: FieldOperation;
  session: ExecutionSession;
  validation: ExecutionValidationResult;
  state: ExecutionState;
  health: ExecutionHealthScores;
  explanation: ExecutionExplanation;
  progress: OperationalProgress;
}

export const FIELD_OPERATION_FINDING_TYPES = ["execution_blocked", "execution_delayed", "execution_paused", "execution_failed", "execution_healthy", "execution_completed", "operational_delay"] as const;
export type FieldOperationFindingType = (typeof FIELD_OPERATION_FINDING_TYPES)[number];

export const FIELD_OPERATION_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type FieldOperationFindingSeverity = (typeof FIELD_OPERATION_FINDING_SEVERITIES)[number];

export interface FieldOperationFinding {
  id: string;
  type: FieldOperationFindingType;
  severity: FieldOperationFindingSeverity;
  description: string;
  relatedFieldOperationId: string | null;
}

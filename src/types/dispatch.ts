import type { ResourceType } from "@/types/allocation";
import type { ExecutionPriority } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 28 — Dispatch Platform. Capability (26.1) determines
 * WHO is eligible. Scheduling (27) determines WHEN work happens.
 * Resource Allocation (27.1) determines WHICH resources should be used.
 * Operational Planning (27.2) determines HOW work should be executed.
 * Execution Package (27.3) determines EVERYTHING required to perform
 * that work — frozen into one immutable snapshot. Dispatch consumes an
 * approved Execution Package and creates Dispatch Orders — it assigns
 * work, it never executes it. Every engine here is a pure, deterministic
 * function over already-computed/already-frozen data — no AI, no
 * randomness, no live execution, no GPS, no route optimization, no
 * evidence capture.
 *
 * A `DispatchAssignment` never recalculates Capability/Scheduling/
 * Allocation — it carries forward exactly the `selected: true` entries
 * from the Execution Package's own frozen `ExecutionSnapshot.allocation_candidates`,
 * unchanged. `DispatchOrder.execution_version_id` pins the exact
 * immutable version consumed, so "which snapshot was dispatched" is
 * always answerable without re-deriving anything.
 */

// ---- Order lifecycle ----

export const DISPATCH_STATUSES = ["draft", "dispatched", "cancelled", "archived"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

/** Reuses `ExecutionPriority`'s exact scale — a dispatch's urgency is the same concept as the package it was built from. */
export type DispatchPriority = ExecutionPriority;

/** `"system_generated"` is reserved vocabulary for a future automated trigger; never emitted this checkpoint — disclosed in `docs/dispatch-engine.md`. */
export const DISPATCH_SOURCES = ["manual", "execution_package_derived", "system_generated"] as const;
export type DispatchSource = (typeof DISPATCH_SOURCES)[number];

// ---- Dispatch Queue — the per-assignment lifecycle (Step 5) ----

/**
 * The spec's own 8 named states. Real precedence: `queued` (created,
 * sitting in the queue) → `assigned` (locked to its named resource,
 * released from the queue) → `pending` (presented, awaiting a
 * response) → one of `accepted`/`declined`/`expired` (terminal
 * responses) or `cancelled` (callable from any non-terminal state).
 * `completed_placeholder` is reserved vocabulary for a future Field
 * Operations "job done" signal — the Stop Condition forbids executing
 * work, so no code path in this checkpoint ever sets it.
 */
export const DISPATCH_QUEUE_STATES = ["queued", "pending", "assigned", "accepted", "declined", "cancelled", "expired", "completed_placeholder"] as const;
export type DispatchQueueState = (typeof DISPATCH_QUEUE_STATES)[number];

/** One transition record for one assignment — the atomic entry "Dispatch History" (Step 1) is built from; `DispatchAssignment.attempts` is its own per-assignment history. */
export interface DispatchAttempt {
  id: string;
  assignment_id: string;
  queue_state: DispatchQueueState;
  reason: string | null;
  created_at: string;
}

export interface DispatchAssignment {
  id: string;
  order_id: string;
  resource_type: ResourceType;
  resource_id: string;
  /** Ties back to which `AllocationRequirementLine` (by index) this assignment fulfills — carried straight from the frozen snapshot's own `AllocationCandidate.requirement_line_index`, never re-derived. */
  requirement_line_index: number;
  queue_state: DispatchQueueState;
  /** The latest decline/cancel reason, when one was given — `null` otherwise. */
  reason: string | null;
  created_at: string;
  responded_at: string | null;
  /** A simple deadline for the `expired` transition — `null` when no timeout applies. */
  expires_at: string | null;
  attempts: DispatchAttempt[];
}

export interface DispatchBatch {
  id: string;
  workspace_id: string;
  name: string;
  order_ids: string[];
  created_by: string;
  created_at: string;
}

export interface DispatchOrder {
  id: string;
  workspace_id: string;
  execution_package_id: string;
  /** The exact immutable `ExecutionVersion` consumed — pinned at creation, never re-resolved to "whatever the current version is now." */
  execution_version_id: string;
  batch_id: string | null;
  status: DispatchStatus;
  priority: DispatchPriority;
  source: DispatchSource;
  assignments: DispatchAssignment[];
  created_by: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  archived_at: string | null;
}

// ---- Computed results (never stored) ----

export interface DispatchValidationIssue {
  rule: string;
  detail: string;
}

export interface DispatchValidationResult {
  valid: boolean;
  errors: DispatchValidationIssue[];
  warnings: DispatchValidationIssue[];
}

export interface DispatchHealthScores {
  assignmentCoverage: number;
  acceptanceRate: number;
  declineRate: number;
  queueHealth: number;
  /** A raw count, not a 0-100 score — how many assignments are awaiting a response right now. */
  pendingCount: number;
  dispatchReadiness: number;
  overallDispatchHealth: number;
}

export interface DispatchExplanation {
  summary: string;
  whyFailed: string[];
  whySucceeded: string[];
  validationFailures: string[];
  acceptanceFailures: string[];
  queueStatus: string;
  dispatchReadinessSummary: string;
}

export interface DispatchOrderResult {
  order: DispatchOrder;
  validation: DispatchValidationResult;
  health: DispatchHealthScores;
  explanation: DispatchExplanation;
}

export const DISPATCH_FINDING_TYPES = ["dispatch_blocked", "low_acceptance_rate", "queue_congestion", "assignment_failure", "resource_rejected", "dispatch_ready"] as const;
export type DispatchFindingType = (typeof DISPATCH_FINDING_TYPES)[number];

export const DISPATCH_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type DispatchFindingSeverity = (typeof DISPATCH_FINDING_SEVERITIES)[number];

export interface DispatchFinding {
  id: string;
  type: DispatchFindingType;
  severity: DispatchFindingSeverity;
  description: string;
  relatedOrderId: string | null;
}

/** Every real-world fact `DispatchValidationEngine` needs but cannot resolve itself — the caller (`dispatchActions.ts`) reads live Worker/Team/Equipment/Vehicle/Vendor status and the live Appointment's status, then hands them in as plain lookups. Keyed `"${resource_type}:${resource_id}"`. */
export interface ResourceStatusLookup {
  resourceStatusByKey: Record<string, string>;
  scheduleActive: boolean;
}

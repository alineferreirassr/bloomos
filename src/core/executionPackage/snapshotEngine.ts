import type { ExecutionSnapshot } from "@/types/executionPackage";
import type { Allocation, ResourceBundle, DependencyCheckResult, ResourcePoolSnapshot } from "@/types/allocation";
import type { OperationalPlan } from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.3, Step 3 — Snapshot Engine. Freezes every piece of
 * already-resolved planning data (Allocation, Schedule, Operational
 * Plan, Bundle, Dependencies, Resource Pool) into one `ExecutionSnapshot`
 * — a plain copy by value, never a live reference back to the source
 * records. This function is pure: it never fetches anything itself, and
 * it never mints an id or timestamp — the caller (`executionPackageActions.ts`)
 * resolves the real Allocation/Appointment/OperationalPlan/Bundle first,
 * then supplies a fresh `id`/`capturedAt` here, the same "pure engine
 * takes pre-resolved inputs" boundary every composed engine in this
 * codebase's prior checkpoints follows.
 *
 * "Worker Candidates" (the spec's own Step 3 line) is satisfied by
 * `allocation.candidates` itself — it already carries every candidate
 * considered, selected or not, each with a `rejection_reason` when
 * rejected — never a second, duplicate candidate-pool concept.
 */

export interface AppointmentSnapshotInput {
  id: string;
  starts_at: string;
  ends_at: string;
  calendar_id: string;
}

export type OperationalPlanSnapshotInput = Pick<OperationalPlan, "id" | "phases" | "milestones" | "deliverables" | "evidence_requirements" | "checklists" | "approvals">;

export interface SnapshotInput {
  allocation: Pick<Allocation, "id" | "strategy" | "candidates"> | null;
  appointment: AppointmentSnapshotInput | null;
  plan: OperationalPlanSnapshotInput | null;
  bundle: ResourceBundle | null;
  dependencyChecks: DependencyCheckResult[];
  resourcePool: ResourcePoolSnapshot | null;
}

export function buildExecutionSnapshot(id: string, capturedAt: string, input: SnapshotInput): ExecutionSnapshot {
  return {
    id,
    captured_at: capturedAt,
    allocation_id: input.allocation?.id ?? null,
    allocation_strategy: input.allocation?.strategy ?? null,
    allocation_candidates: input.allocation?.candidates ?? [],
    appointment_id: input.appointment?.id ?? null,
    scheduled_starts_at: input.appointment?.starts_at ?? null,
    scheduled_ends_at: input.appointment?.ends_at ?? null,
    calendar_id: input.appointment?.calendar_id ?? null,
    operational_plan_id: input.plan?.id ?? null,
    phases: input.plan?.phases ?? [],
    milestones: input.plan?.milestones ?? [],
    deliverables: input.plan?.deliverables ?? [],
    evidence_requirements: input.plan?.evidence_requirements ?? [],
    checklists: input.plan?.checklists ?? [],
    approvals: input.plan?.approvals ?? [],
    bundle_id: input.bundle?.id ?? null,
    bundle_snapshot: input.bundle,
    dependency_checks: input.dependencyChecks,
    resource_pool: input.resourcePool,
  };
}

/**
 * Step 13's "Version Drift" finding needs this one comparison: has the
 * live source record changed since this snapshot was captured? A plain
 * timestamp comparison, reused for both the Allocation and the
 * Operational Plan the snapshot was built from — never re-diffing the
 * actual field values, since "did it change at all" is all Version
 * Drift needs to answer. `liveUpdatedAt: null` (the source no longer
 * exists) is never treated as drift here — a missing source is a
 * `missing_requirement`/validation concern, not a staleness concern.
 */
export function hasSnapshotDrifted(capturedAt: string, liveUpdatedAt: string | null): boolean {
  if (liveUpdatedAt === null) return false;
  return new Date(liveUpdatedAt).getTime() > new Date(capturedAt).getTime();
}

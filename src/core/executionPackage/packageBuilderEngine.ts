import type { ExecutionContext, ExecutionMetadata, ExecutionPriority, ExecutionContextType } from "@/types/executionPackage";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 27.3, Step 2 — Package Builder. Assembles a package's
 * `ExecutionContext`/`ExecutionMetadata` from already-resolved planning
 * data — Operational Plan (context), Allocation Request (location/priority),
 * an explicit Customer reference, an explicit priority override. Pure and
 * deterministic; never fetches anything itself.
 *
 * "Capability" (the spec's own Step 2 line) needs no dedicated field
 * here — a `CapabilityRequirement` reference already flows through on
 * each `ExecutionStep.required_capability_requirement_id` inside the
 * snapshot's own `phases`, carried over by `SnapshotEngine`, never
 * re-declared at the package level. "Business Rules" is satisfied by
 * `PackageValidationEngine` (Step 4), which runs immediately after a
 * package is built — never a second, duplicate rule engine (the Stop
 * Condition is explicit: never duplicate Operational Intelligence's
 * own Business Rule Engine).
 */

export interface PackageContextInput {
  planContextType: ExecutionContextType;
  planContext: KnowledgeNodeRef | null;
  customer: KnowledgeNodeRef | null;
  locationPlaceholder: string | null;
  requestedPriority: ExecutionPriority | null;
  priorityOverride: ExecutionPriority | null;
}

const DEFAULT_PRIORITY: ExecutionPriority = "medium";

export function buildExecutionContext(input: PackageContextInput): ExecutionContext {
  return {
    context_type: input.planContextType,
    context: input.planContext,
    customer: input.customer,
    location_placeholder: input.locationPlaceholder,
    priority: input.priorityOverride ?? input.requestedPriority ?? DEFAULT_PRIORITY,
  };
}

export function buildExecutionMetadata(planName: string, notes: string | null = null, tags: string[] = []): ExecutionMetadata {
  return { title: `${planName} — Execution Package`, notes, tags };
}

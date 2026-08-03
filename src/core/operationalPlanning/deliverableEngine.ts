import type { Deliverable } from "@/types/operationalPlanning";

/** v2.0 Checkpoint 27.2, Step 7 — Deliverable Engine. Pure reads over a plan's own `deliverables` array — tracks pending/ready/delivered/rejected, never produces or transports an actual deliverable. */

export interface DeliverableCoverage {
  total: number;
  delivered: number;
  ratio: number;
}

/** Vacuous 100%-equivalent (`ratio: 1`) for a plan with zero deliverables. */
export function deliverableCoverage(deliverables: Deliverable[]): DeliverableCoverage {
  const delivered = deliverables.filter((d) => d.status === "delivered").length;
  return { total: deliverables.length, delivered, ratio: deliverables.length === 0 ? 1 : delivered / deliverables.length };
}

export function findIncompleteDeliverables(deliverables: Deliverable[]): Deliverable[] {
  return deliverables.filter((d) => d.status !== "delivered");
}

export function findRejectedDeliverables(deliverables: Deliverable[]): Deliverable[] {
  return deliverables.filter((d) => d.status === "rejected");
}

/** A deliverable whose `produced_by_step_id` doesn't resolve to a real step in this plan. */
export function findOrphanedDeliverables(deliverables: Deliverable[], realStepIds: ReadonlySet<string>): Deliverable[] {
  return deliverables.filter((d) => d.produced_by_step_id !== null && !realStepIds.has(d.produced_by_step_id));
}

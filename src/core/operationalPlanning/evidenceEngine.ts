import type { EvidenceRequirement, ExecutionPhase, Milestone } from "@/types/operationalPlanning";
import { flattenSteps } from "@/core/operationalPlanning/executionStepEngine";

/**
 * v2.0 Checkpoint 27.2, Step 8 — Evidence Engine. Declarative only, per
 * the spec: an `EvidenceRequirement` states what evidence a step or
 * milestone needs (a photo, a GPS confirmation, a digital signature
 * placeholder, ...) — this file never captures, stores, or validates an
 * actual piece of evidence. No "submitted"/"verified" status exists on
 * `EvidenceRequirement` at all; that's explicitly out of scope until a
 * future Dispatch/Field Operations checkpoint builds real capture.
 */

export function evidenceForStep(evidence: EvidenceRequirement[], stepId: string): EvidenceRequirement[] {
  return evidence.filter((e) => e.step_id === stepId);
}

export function evidenceForMilestone(evidence: EvidenceRequirement[], milestoneId: string): EvidenceRequirement[] {
  return evidence.filter((e) => e.milestone_id === milestoneId);
}

/** An evidence requirement pointing at neither a real step nor a real milestone in this plan (including one with both fields `null` — an unattached requirement). */
export function findOrphanedEvidenceRequirements(evidence: EvidenceRequirement[], phases: ExecutionPhase[], milestones: Milestone[]): EvidenceRequirement[] {
  const stepIds = new Set(flattenSteps(phases).map((s) => s.id));
  const milestoneIds = new Set(milestones.map((m) => m.id));
  return evidence.filter((e) => {
    if (e.step_id === null && e.milestone_id === null) return true;
    if (e.step_id !== null && !stepIds.has(e.step_id)) return true;
    if (e.milestone_id !== null && !milestoneIds.has(e.milestone_id)) return true;
    return false;
  });
}

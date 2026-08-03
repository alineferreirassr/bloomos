import { describe, expect, it } from "vitest";
import { evidenceForStep, evidenceForMilestone, findOrphanedEvidenceRequirements } from "@/core/operationalPlanning/evidenceEngine";
import type { EvidenceRequirement, ExecutionPhase, Milestone } from "@/types/operationalPlanning";

function makeEvidence(id: string, stepId: string | null, milestoneId: string | null): EvidenceRequirement {
  return { id, type: "photo", description: "Photo of setup", step_id: stepId, milestone_id: milestoneId };
}

const phases: ExecutionPhase[] = [{ id: "phase_1", kind: "setup", name: "Setup", order: 0, steps: [{ id: "step_1", title: "Set up decor", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] }];
const milestones: Milestone[] = [{ id: "milestone_1", title: "Setup complete", target_phase_id: "phase_1", completion_criteria: "All decor placed", evidence_requirement_ids: [], approval_required: false, status: "not_started" }];

describe("evidenceForStep / evidenceForMilestone", () => {
  it("filters by owner", () => {
    const evidence = [makeEvidence("e1", "step_1", null), makeEvidence("e2", null, "milestone_1")];
    expect(evidenceForStep(evidence, "step_1").map((e) => e.id)).toEqual(["e1"]);
    expect(evidenceForMilestone(evidence, "milestone_1").map((e) => e.id)).toEqual(["e2"]);
  });
});

describe("findOrphanedEvidenceRequirements", () => {
  it("flags evidence attached to neither a real step nor a real milestone", () => {
    const evidence = [makeEvidence("e1", "step_missing", null), makeEvidence("e2", "step_1", null), makeEvidence("e3", null, null)];
    const orphaned = findOrphanedEvidenceRequirements(evidence, phases, milestones);
    expect(orphaned.map((e) => e.id).sort()).toEqual(["e1", "e3"]);
  });
});

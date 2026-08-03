import { describe, expect, it } from "vitest";
import { milestoneProgress, findBlockedMilestones, findIncompleteMilestones, findOrphanedMilestones } from "@/core/operationalPlanning/milestoneEngine";
import type { Milestone, MilestoneStatus } from "@/types/operationalPlanning";

function makeMilestone(id: string, status: MilestoneStatus, targetPhaseId: string | null = null): Milestone {
  return { id, title: id, target_phase_id: targetPhaseId, completion_criteria: "Done", evidence_requirement_ids: [], approval_required: false, status };
}

describe("milestoneProgress", () => {
  it("is vacuous (ratio 1) for zero milestones", () => {
    expect(milestoneProgress([])).toEqual({ total: 0, completed: 0, ratio: 1 });
  });

  it("computes completed/total ratio", () => {
    const milestones = [makeMilestone("m1", "completed"), makeMilestone("m2", "in_progress"), makeMilestone("m3", "completed")];
    expect(milestoneProgress(milestones)).toEqual({ total: 3, completed: 2, ratio: 2 / 3 });
  });
});

describe("findBlockedMilestones / findIncompleteMilestones", () => {
  it("filters correctly", () => {
    const milestones = [makeMilestone("m1", "completed"), makeMilestone("m2", "blocked"), makeMilestone("m3", "not_started")];
    expect(findBlockedMilestones(milestones).map((m) => m.id)).toEqual(["m2"]);
    expect(findIncompleteMilestones(milestones).map((m) => m.id)).toEqual(["m2", "m3"]);
  });
});

describe("findOrphanedMilestones", () => {
  it("flags a milestone targeting a phase that doesn't exist", () => {
    const milestones = [makeMilestone("m1", "not_started", "phase_missing"), makeMilestone("m2", "not_started", "phase_1")];
    const orphaned = findOrphanedMilestones(milestones, new Set(["phase_1"]));
    expect(orphaned.map((m) => m.id)).toEqual(["m1"]);
  });

  it("never flags a plan-level milestone (target_phase_id: null)", () => {
    const milestones = [makeMilestone("m1", "not_started", null)];
    expect(findOrphanedMilestones(milestones, new Set())).toHaveLength(0);
  });
});

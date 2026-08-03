import { describe, it, expect } from "vitest";
import { computeJourneyProgress, computeJourneyMilestones, withBlockedStages, CORE_PROGRESS_STAGES, JOURNEY_STAGE_WEIGHTS } from "./journeyProgressEngine";

describe("computeJourneyProgress", () => {
  it("reports only the New Lead milestone's own small weight for a brand-new lead", () => {
    const progress = computeJourneyProgress({ currentStage: "new_lead", requirementsForCurrentStage: [] });
    expect(progress.overallPercentage).toBeLessThan(5);
    expect(progress.overallPercentage).toBeGreaterThan(0);
  });

  it("reports 100% once the journey is closed", () => {
    const progress = computeJourneyProgress({ currentStage: "closed", requirementsForCurrentStage: [] });
    expect(progress.overallPercentage).toBe(100);
  });

  it("excludes optional stages (Discovery, Negotiation) from the core percentage", () => {
    expect(CORE_PROGRESS_STAGES).not.toContain("discovery");
    expect(CORE_PROGRESS_STAGES).not.toContain("negotiation");
  });

  it("weights commitment stages heavier than administrative ones", () => {
    expect(JOURNEY_STAGE_WEIGHTS.contract_signed).toBeGreaterThan(JOURNEY_STAGE_WEIGHTS.contract_preparation);
    expect(JOURNEY_STAGE_WEIGHTS.deposit_paid).toBeGreaterThan(JOURNEY_STAGE_WEIGHTS.invoice_preparation);
  });

  it("computes currentStageProgress from the ratio of met requirements", () => {
    const progress = computeJourneyProgress({
      currentStage: "proposal_sent",
      requirementsForCurrentStage: [
        { key: "a", label: "A", stage: "proposal_sent", met: true, sourceModule: "x", sourceRecordId: null, detail: "" },
        { key: "b", label: "B", stage: "proposal_sent", met: false, sourceModule: "x", sourceRecordId: null, detail: "" },
      ],
    });
    expect(progress.currentStageProgress).toBe(50);
  });

  it("defaults currentStageProgress to 100 when no requirements are defined for the stage", () => {
    const progress = computeJourneyProgress({ currentStage: "planning", requirementsForCurrentStage: [] });
    expect(progress.currentStageProgress).toBe(100);
  });

  it("lists skipped optional stages that were passed over", () => {
    const progress = computeJourneyProgress({ currentStage: "contract_signed", requirementsForCurrentStage: [] });
    expect(progress.skippedStages).toContain("discovery");
    expect(progress.skippedStages).toContain("negotiation");
  });

  it("leaves remainingRequiredStages empty for a terminal journey", () => {
    const progress = computeJourneyProgress({ currentStage: "lost", requirementsForCurrentStage: [] });
    expect(progress.remainingRequiredStages).toEqual([]);
  });
});

describe("computeJourneyMilestones", () => {
  it("marks every core stage up to and including the current stage as completed", () => {
    const milestones = computeJourneyMilestones({ currentStage: "contract_signed", requirementsForCurrentStage: [] });
    const proposalPrep = milestones.find((m) => m.stage === "proposal_preparation");
    const invoicePrep = milestones.find((m) => m.stage === "invoice_preparation");
    expect(proposalPrep?.completed).toBe(true);
    expect(invoicePrep?.completed).toBe(false);
  });
});

describe("withBlockedStages", () => {
  it("dedupes and merges blocked stage ids into the progress object", () => {
    const progress = computeJourneyProgress({ currentStage: "qualified", requirementsForCurrentStage: [] });
    const updated = withBlockedStages(progress, ["contract_signed", "contract_signed", "deposit_paid"]);
    expect(updated.blockedStages).toEqual(["contract_signed", "deposit_paid"]);
  });
});

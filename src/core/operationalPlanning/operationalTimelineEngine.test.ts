import { describe, expect, it } from "vitest";
import { planCreatedEvent, planUpdatedEvent, planApprovedEvent, planArchivedEvent, phaseAddedEvent, stepAddedEvent, milestoneCompletedEvent, approvalRequiredEvent, deliverableAddedEvent, evidenceRequirementAddedEvent } from "@/core/operationalPlanning/operationalTimelineEngine";

describe("operationalTimelineEngine", () => {
  it("planCreatedEvent", () => {
    expect(planCreatedEvent("Wedding Proposal Plan")).toEqual({ type: "plan_created", description: 'Operational plan "Wedding Proposal Plan" created.' });
  });

  it("planUpdatedEvent", () => {
    expect(planUpdatedEvent("Wedding Proposal Plan")).toEqual({ type: "plan_updated", description: 'Operational plan "Wedding Proposal Plan" updated.' });
  });

  it("planApprovedEvent", () => {
    expect(planApprovedEvent("Wedding Proposal Plan")).toEqual({ type: "plan_approved", description: 'Operational plan "Wedding Proposal Plan" approved.' });
  });

  it("planArchivedEvent", () => {
    expect(planArchivedEvent("Wedding Proposal Plan")).toEqual({ type: "plan_archived", description: 'Operational plan "Wedding Proposal Plan" archived.' });
  });

  it("phaseAddedEvent", () => {
    expect(phaseAddedEvent("Setup")).toEqual({ type: "phase_added", description: 'Execution phase "Setup" added.' });
  });

  it("stepAddedEvent", () => {
    expect(stepAddedEvent("Deliver flowers")).toEqual({ type: "step_added", description: 'Execution step "Deliver flowers" added.' });
  });

  it("milestoneCompletedEvent", () => {
    expect(milestoneCompletedEvent("Setup complete")).toEqual({ type: "milestone_completed", description: 'Milestone "Setup complete" completed.' });
  });

  it("approvalRequiredEvent", () => {
    expect(approvalRequiredEvent("Manager sign-off")).toEqual({ type: "approval_required", description: "Approval required: Manager sign-off" });
  });

  it("deliverableAddedEvent", () => {
    expect(deliverableAddedEvent("Final photos")).toEqual({ type: "deliverable_added", description: 'Deliverable "Final photos" added.' });
  });

  it("evidenceRequirementAddedEvent", () => {
    expect(evidenceRequirementAddedEvent("Photo of setup")).toEqual({ type: "evidence_requirement_added", description: "Evidence requirement added: Photo of setup" });
  });
});

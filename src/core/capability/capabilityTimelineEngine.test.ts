import { describe, expect, it } from "vitest";
import { requirementCreatedEvent, requirementUpdatedEvent, requirementArchivedEvent, stateTransitionEvent, scoreChangedEvent, certificationExpiredEvent, blockerDetectedEvent } from "@/core/capability/capabilityTimelineEngine";

describe("capabilityTimelineEngine", () => {
  it("requirement lifecycle events map to the right type", () => {
    expect(requirementCreatedEvent("Lead Rigger").type).toBe("capability_requirement_created");
    expect(requirementUpdatedEvent("Lead Rigger").type).toBe("capability_requirement_updated");
    expect(requirementArchivedEvent("Lead Rigger").type).toBe("capability_requirement_archived");
  });

  it("stateTransitionEvent maps each next state to its own named event", () => {
    expect(stateTransitionEvent("Ana", "Lead Rigger", null, "eligible").type).toBe("worker_became_eligible");
    expect(stateTransitionEvent("Ana", "Lead Rigger", "eligible", "ineligible").type).toBe("worker_became_ineligible");
    expect(stateTransitionEvent("Ana", "Lead Rigger", "eligible", "conditionally_eligible").type).toBe("worker_became_conditionally_eligible");
    expect(stateTransitionEvent("Ana", "Lead Rigger", "eligible", "unknown").type).toBe("worker_evaluated");
  });

  it("scoreChangedEvent names both scores in the description", () => {
    const event = scoreChangedEvent("Ana", "Lead Rigger", 60, 90);
    expect(event.type).toBe("capability_score_changed");
    expect(event.description).toContain("60");
    expect(event.description).toContain("90");
  });

  it("certificationExpiredEvent and blockerDetectedEvent produce their own named types", () => {
    expect(certificationExpiredEvent("Ana", "OSHA 30").type).toBe("certification_became_expired");
    expect(blockerDetectedEvent("Ana", "Lead Rigger", "Missing required skill.").type).toBe("capability_blocker_detected");
  });
});

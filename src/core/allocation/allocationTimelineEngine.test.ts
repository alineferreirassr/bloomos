import { describe, expect, it } from "vitest";
import { allocationCreatedEvent, allocationUpdatedEvent, allocationRecalculatedEvent, allocationFallbackUsedEvent, allocationDependencyFailedEvent, allocationBundleCompletedEvent, allocationApprovedEvent, allocationArchivedEvent } from "@/core/allocation/allocationTimelineEngine";

describe("allocationTimelineEngine", () => {
  it("allocationCreatedEvent", () => {
    expect(allocationCreatedEvent("highest capability")).toEqual({ type: "allocation_created", description: "Allocation proposal created (highest capability)." });
  });

  it("allocationUpdatedEvent", () => {
    expect(allocationUpdatedEvent()).toEqual({ type: "allocation_updated", description: "Allocation candidates updated." });
  });

  it("allocationRecalculatedEvent", () => {
    expect(allocationRecalculatedEvent()).toEqual({ type: "allocation_recalculated", description: "Allocation recalculated." });
  });

  it("allocationFallbackUsedEvent", () => {
    expect(allocationFallbackUsedEvent("worker", 1)).toEqual({ type: "allocation_fallback_used", description: "A tier 1 worker fallback was used." });
  });

  it("allocationDependencyFailedEvent", () => {
    expect(allocationDependencyFailedEvent("A drone requires a certified operator.")).toEqual({ type: "allocation_dependency_failed", description: "Dependency not satisfied: A drone requires a certified operator." });
  });

  it("allocationBundleCompletedEvent", () => {
    expect(allocationBundleCompletedEvent("Photography Crew")).toEqual({ type: "allocation_bundle_completed", description: 'Bundle "Photography Crew" fully satisfied.' });
  });

  it("allocationApprovedEvent", () => {
    expect(allocationApprovedEvent()).toEqual({ type: "allocation_approved", description: "Allocation approved." });
  });

  it("allocationArchivedEvent", () => {
    expect(allocationArchivedEvent()).toEqual({ type: "allocation_archived", description: "Allocation archived." });
  });
});

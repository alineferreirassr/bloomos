import { describe, expect, it } from "vitest";
import { dispatchCreatedEvent, assignmentCreatedEvent, assignmentAcceptedEvent, assignmentDeclinedEvent, dispatchCancelledEvent, dispatchArchivedEvent, queueUpdatedEvent } from "@/core/dispatch/dispatchTimelineEngine";

describe("dispatchTimelineEngine", () => {
  it("builds a dispatch_created event with the assignment count", () => {
    expect(dispatchCreatedEvent(2)).toEqual({ type: "dispatch_created", description: "Dispatch order created with 2 assignments." });
    expect(dispatchCreatedEvent(1).description).toContain("1 assignment.");
  });

  it("builds a dispatch_assignment_created event", () => {
    expect(assignmentCreatedEvent("worker", "worker_1").type).toBe("dispatch_assignment_created");
  });

  it("builds an assignment_accepted event", () => {
    expect(assignmentAcceptedEvent("worker", "worker_1").type).toBe("assignment_accepted");
  });

  it("builds an assignment_declined event including the reason", () => {
    const event = assignmentDeclinedEvent("worker", "worker_1", "Not available");
    expect(event.type).toBe("assignment_declined");
    expect(event.description).toContain("Not available");
  });

  it("builds dispatch_cancelled/dispatch_archived events", () => {
    expect(dispatchCancelledEvent().type).toBe("dispatch_cancelled");
    expect(dispatchArchivedEvent().type).toBe("dispatch_archived");
  });

  it("builds a queue_updated event reflecting the new state", () => {
    const event = queueUpdatedEvent("assigned");
    expect(event.type).toBe("queue_updated");
    expect(event.description).toContain("assigned");
  });
});

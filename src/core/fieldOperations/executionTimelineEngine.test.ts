import { describe, expect, it } from "vitest";
import { executionStartedEvent, executionPausedEvent, executionResumedEvent, executionCompletedEvent, executionCancelledEvent, executionFailedEvent, executionArchivedEvent } from "@/core/fieldOperations/executionTimelineEngine";

describe("executionTimelineEngine", () => {
  it("builds an execution_started event", () => {
    expect(executionStartedEvent()).toEqual({ type: "execution_started", description: "Execution started." });
  });

  it("builds an execution_paused event including the reason when given", () => {
    expect(executionPausedEvent("Weather delay").description).toContain("Weather delay");
    expect(executionPausedEvent(null).description).toBe("Execution paused.");
  });

  it("builds an execution_resumed event", () => {
    expect(executionResumedEvent().type).toBe("execution_resumed");
  });

  it("builds an execution_completed event", () => {
    expect(executionCompletedEvent().type).toBe("execution_completed");
  });

  it("builds an execution_cancelled event including the reason", () => {
    const event = executionCancelledEvent("Client rescheduled");
    expect(event.type).toBe("execution_cancelled");
    expect(event.description).toContain("Client rescheduled");
  });

  it("builds an execution_failed event including the reason", () => {
    const event = executionFailedEvent("Equipment malfunction");
    expect(event.type).toBe("execution_failed");
    expect(event.description).toContain("Equipment malfunction");
  });

  it("builds an execution_archived event", () => {
    expect(executionArchivedEvent().type).toBe("execution_archived");
  });
});

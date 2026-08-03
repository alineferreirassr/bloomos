import { describe, expect, it } from "vitest";
import { computeExecutionState } from "@/core/fieldOperations/executionStateEngine";
import type { ExecutionSession, ExecutionAttempt } from "@/types/fieldOperations";

function attempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
  return { id: "attempt_1", session_id: "session_1", lifecycle_state: "started", reason: null, created_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function buildSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "session_1",
    field_operation_id: "field_operation_1",
    lifecycle_state: "created",
    outcome: null,
    reason: null,
    current_phase_id: null,
    completed_step_ids: [],
    completed_milestone_ids: [],
    completed_checklist_item_ids: [],
    completed_deliverable_ids: [],
    started_at: null,
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    attempts: [],
    ...overrides,
  };
}

describe("executionStateEngine", () => {
  it("reports no previous state and zero durations for a session that never transitioned", () => {
    const session = buildSession();
    const state = computeExecutionState(session, "2026-01-01T00:05:00.000Z");
    expect(state.currentState).toBe("created");
    expect(state.previousState).toBeNull();
    expect(state.executionDurationSeconds).toBe(0);
    expect(state.completionDurationSeconds).toBeNull();
    expect(state.elapsedTimeSeconds).toBe(300);
  });

  it("reports 'created' as the previous state after exactly one transition", () => {
    const session = buildSession({
      lifecycle_state: "started",
      started_at: "2026-01-01T00:01:00.000Z",
      attempts: [attempt({ lifecycle_state: "started", created_at: "2026-01-01T00:01:00.000Z" })],
    });
    const state = computeExecutionState(session, "2026-01-01T00:05:00.000Z");
    expect(state.previousState).toBe("created");
    expect(state.executionDurationSeconds).toBe(240);
  });

  it("sums a single pause/resume cycle correctly", () => {
    const session = buildSession({
      lifecycle_state: "resumed",
      started_at: "2026-01-01T00:00:00.000Z",
      paused_at: "2026-01-01T00:02:00.000Z",
      resumed_at: "2026-01-01T00:04:00.000Z",
      attempts: [
        attempt({ id: "a1", lifecycle_state: "started", created_at: "2026-01-01T00:00:00.000Z" }),
        attempt({ id: "a2", lifecycle_state: "paused", created_at: "2026-01-01T00:02:00.000Z" }),
        attempt({ id: "a3", lifecycle_state: "resumed", created_at: "2026-01-01T00:04:00.000Z" }),
      ],
    });
    const state = computeExecutionState(session, "2026-01-01T00:10:00.000Z");
    expect(state.pauseDurationSeconds).toBe(120);
    // 10 minutes elapsed since start, minus 2 minutes paused = 8 minutes of real execution
    expect(state.executionDurationSeconds).toBe(480);
    expect(state.previousState).toBe("paused");
  });

  it("counts an open-ended pause (no resume yet) up to now", () => {
    const session = buildSession({
      lifecycle_state: "paused",
      started_at: "2026-01-01T00:00:00.000Z",
      paused_at: "2026-01-01T00:02:00.000Z",
      attempts: [attempt({ id: "a1", lifecycle_state: "started", created_at: "2026-01-01T00:00:00.000Z" }), attempt({ id: "a2", lifecycle_state: "paused", created_at: "2026-01-01T00:02:00.000Z" })],
    });
    const state = computeExecutionState(session, "2026-01-01T00:03:00.000Z");
    expect(state.pauseDurationSeconds).toBe(60);
  });

  it("sums multiple pause/resume cycles", () => {
    const session = buildSession({
      lifecycle_state: "resumed",
      started_at: "2026-01-01T00:00:00.000Z",
      attempts: [
        attempt({ id: "a1", lifecycle_state: "started", created_at: "2026-01-01T00:00:00.000Z" }),
        attempt({ id: "a2", lifecycle_state: "paused", created_at: "2026-01-01T00:01:00.000Z" }),
        attempt({ id: "a3", lifecycle_state: "resumed", created_at: "2026-01-01T00:02:00.000Z" }),
        attempt({ id: "a4", lifecycle_state: "paused", created_at: "2026-01-01T00:03:00.000Z" }),
        attempt({ id: "a5", lifecycle_state: "resumed", created_at: "2026-01-01T00:05:00.000Z" }),
      ],
    });
    const state = computeExecutionState(session, "2026-01-01T00:06:00.000Z");
    // pause 1: 60s, pause 2: 120s = 180s total
    expect(state.pauseDurationSeconds).toBe(180);
  });

  it("computes completionDurationSeconds only once completed_at is set", () => {
    const session = buildSession({
      lifecycle_state: "completed",
      started_at: "2026-01-01T00:00:00.000Z",
      completed_at: "2026-01-01T00:10:00.000Z",
      attempts: [attempt({ lifecycle_state: "started" }), attempt({ lifecycle_state: "completed", created_at: "2026-01-01T00:10:00.000Z" })],
    });
    const state = computeExecutionState(session, "2026-01-01T00:15:00.000Z");
    expect(state.completionDurationSeconds).toBe(600);
    // now is ignored once completed — elapsed/execution duration freeze at completion
    expect(state.elapsedTimeSeconds).toBe(600);
  });

  it("exposes the raw attempt log as transitionHistory, unmodified", () => {
    const attempts = [attempt({ id: "a1" }), attempt({ id: "a2", lifecycle_state: "paused" })];
    const session = buildSession({ attempts });
    const state = computeExecutionState(session, "2026-01-01T00:10:00.000Z");
    expect(state.transitionHistory).toEqual(attempts);
  });
});

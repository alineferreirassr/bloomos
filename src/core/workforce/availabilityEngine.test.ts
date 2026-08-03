import { describe, expect, it } from "vitest";
import { resolveCurrentAvailability, isWorkerAvailableAt, computeAvailabilitySummary } from "@/core/workforce/availabilityEngine";
import type { Worker, AvailabilityWindow, Assignment } from "@/types/workforce";

const NOW = "2026-07-30T12:00:00.000Z";

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "worker_1",
    workspace_id: "ws_1",
    first_name: "Ana",
    last_name: "Ferreira",
    email: "ana@example.com",
    phone: null,
    role: "technician",
    employment_type: "full_time",
    status: "active",
    current_activity: "idle",
    team_id: null,
    supervisor_worker_id: null,
    linked_member_id: null,
    time_zone: "America/Sao_Paulo",
    language: "en",
    languages: ["en"],
    experience_level: "entry",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [],
    certifications: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeWindow(overrides: Partial<AvailabilityWindow> = {}): AvailabilityWindow {
  return {
    id: "window_1",
    worker_id: "worker_1",
    workspace_id: "ws_1",
    status: "available",
    starts_at: "2026-07-30T08:00:00.000Z",
    ends_at: null,
    note: null,
    time_zone: "America/Sao_Paulo",
    created_at: "2026-07-30T08:00:00.000Z",
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment_1",
    workspace_id: "ws_1",
    worker_id: "worker_1",
    assignable_type: "event",
    assignable_id: "event_1",
    role_note: null,
    status: "active",
    starts_at: "2026-07-30T08:00:00.000Z",
    ends_at: null,
    created_by: "member_1",
    created_at: "2026-07-30T08:00:00.000Z",
    updated_at: "2026-07-30T08:00:00.000Z",
    ...overrides,
  };
}

describe("resolveCurrentAvailability", () => {
  it("returns the covering window's status when no active assignment exists", () => {
    const worker = makeWorker();
    const windows = [makeWindow({ status: "available" })];
    expect(resolveCurrentAvailability(worker, windows, [], NOW)).toBe("available");
  });

  it("returns 'on_assignment' when the worker has an active assignment, overriding a stale 'available' window", () => {
    const worker = makeWorker();
    const windows = [makeWindow({ status: "available" })];
    const assignments = [makeAssignment()];
    expect(resolveCurrentAvailability(worker, windows, assignments, NOW)).toBe("on_assignment");
  });

  it("falls back to the most recent past window when nothing currently covers now", () => {
    const worker = makeWorker();
    const windows = [
      makeWindow({ id: "w1", status: "vacation", starts_at: "2026-07-01T00:00:00.000Z", ends_at: "2026-07-10T00:00:00.000Z" }),
      makeWindow({ id: "w2", status: "training", starts_at: "2026-07-20T00:00:00.000Z", ends_at: "2026-07-25T00:00:00.000Z" }),
    ];
    expect(resolveCurrentAvailability(worker, windows, [], NOW)).toBe("training");
  });

  it("returns 'unavailable' when the worker has no windows at all and no active assignment", () => {
    const worker = makeWorker();
    expect(resolveCurrentAvailability(worker, [], [], NOW)).toBe("unavailable");
  });

  it("ignores another worker's active assignment", () => {
    const worker = makeWorker({ id: "worker_2" });
    const windows = [makeWindow({ worker_id: "worker_2", status: "busy" })];
    const assignments = [makeAssignment({ worker_id: "worker_1" })];
    expect(resolveCurrentAvailability(worker, windows, assignments, NOW)).toBe("busy");
  });

  it("ignores a completed (non-active) assignment", () => {
    const worker = makeWorker();
    const windows = [makeWindow({ status: "available" })];
    const assignments = [makeAssignment({ status: "completed" })];
    expect(resolveCurrentAvailability(worker, windows, assignments, NOW)).toBe("available");
  });
});

describe("isWorkerAvailableAt", () => {
  it("is true only when resolved status is exactly 'available'", () => {
    const worker = makeWorker();
    expect(isWorkerAvailableAt(worker, [makeWindow({ status: "available" })], [], NOW)).toBe(true);
    expect(isWorkerAvailableAt(worker, [makeWindow({ status: "busy" })], [], NOW)).toBe(false);
  });
});

describe("computeAvailabilitySummary", () => {
  it("tallies every worker into exactly one bucket", () => {
    const workerA = makeWorker({ id: "a" });
    const workerB = makeWorker({ id: "b" });
    const workerC = makeWorker({ id: "c" });
    const windows = [makeWindow({ worker_id: "a", status: "available" }), makeWindow({ worker_id: "b", status: "vacation" })];
    const assignments = [makeAssignment({ worker_id: "c" })];

    const summary = computeAvailabilitySummary([workerA, workerB, workerC], windows, assignments, NOW);
    expect(summary.available).toBe(1);
    expect(summary.vacation).toBe(1);
    expect(summary.onAssignment).toBe(1);
    expect(summary.available + summary.vacation + summary.onAssignment + summary.busy + summary.onBreak + summary.offDuty + summary.sickLeave + summary.training + summary.unavailable).toBe(3);
  });
});

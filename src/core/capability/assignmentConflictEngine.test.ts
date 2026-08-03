import { describe, expect, it } from "vitest";
import { detectWorkerAssignmentConflict, hasEquipmentConflict, hasVehicleConflict, evaluateTeamCapacity } from "@/core/capability/assignmentConflictEngine";
import type { Assignment, Equipment, Vehicle, Team } from "@/types/workforce";

const NOW = "2026-07-30T00:00:00.000Z";

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return { id: "a1", workspace_id: "ws_1", worker_id: "worker_1", assignable_type: "event", assignable_id: "event_1", role_note: null, status: "active", starts_at: NOW, ends_at: null, created_by: "member_1", created_at: NOW, updated_at: NOW, ...overrides };
}

describe("detectWorkerAssignmentConflict", () => {
  it("detects a duplicate active assignment to the exact same target", () => {
    const result = detectWorkerAssignmentConflict("worker_1", "event", "event_1", [makeAssignment()]);
    expect(result.hasDuplicateAssignment).toBe(true);
    expect(result.conflictingAssignmentIds).toEqual(["a1"]);
  });

  it("does not conflict against a different target", () => {
    const result = detectWorkerAssignmentConflict("worker_1", "event", "event_2", [makeAssignment()]);
    expect(result.hasDuplicateAssignment).toBe(false);
  });

  it("does not conflict against a completed assignment", () => {
    const result = detectWorkerAssignmentConflict("worker_1", "event", "event_1", [makeAssignment({ status: "completed" })]);
    expect(result.hasDuplicateAssignment).toBe(false);
  });

  it("counts only this worker's active assignments toward workerActiveAssignmentCount", () => {
    const assignments = [makeAssignment({ id: "a1" }), makeAssignment({ id: "a2", assignable_id: "event_2" }), makeAssignment({ id: "a3", worker_id: "worker_2" })];
    expect(detectWorkerAssignmentConflict("worker_1", "event", "event_3", assignments).workerActiveAssignmentCount).toBe(2);
  });
});

describe("hasEquipmentConflict / hasVehicleConflict", () => {
  it("is a conflict only when in_use by a different worker", () => {
    const equipment: Equipment = { id: "e1", workspace_id: "ws_1", name: "Drone", category: "drone", status: "in_use", assigned_worker_id: "worker_2", serial_number: null, notes: null, created_at: NOW, updated_at: NOW, archived_at: null };
    expect(hasEquipmentConflict(equipment, "worker_1")).toBe(true);
    expect(hasEquipmentConflict(equipment, "worker_2")).toBe(false);
    expect(hasEquipmentConflict({ ...equipment, status: "available" }, "worker_1")).toBe(false);
  });

  it("vehicle mirrors equipment", () => {
    const vehicle: Vehicle = { id: "v1", workspace_id: "ws_1", label: "Van", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, status: "in_use", assigned_worker_id: "worker_2", notes: null, created_at: NOW, updated_at: NOW, archived_at: null };
    expect(hasVehicleConflict(vehicle, "worker_1")).toBe(true);
    expect(hasVehicleConflict(vehicle, "worker_2")).toBe(false);
  });
});

describe("evaluateTeamCapacity", () => {
  it("counts members with zero active assignments as available", () => {
    const team: Team = { id: "team_1", workspace_id: "ws_1", name: "Crew", description: null, leader_worker_id: null, member_worker_ids: ["worker_1", "worker_2", "worker_3"], status: "active", created_at: NOW, updated_at: NOW, archived_at: null };
    const assignments = [makeAssignment({ worker_id: "worker_1" })];
    const result = evaluateTeamCapacity(team, assignments);
    expect(result.memberCount).toBe(3);
    expect(result.availableMemberCount).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  workerCreatedEvent,
  workerStatusChangedEvent,
  workerAvailabilityChangedEvent,
  teamStatusEvent,
  teamUpdatedEvent,
  workerAddedToTeamEvent,
  assignmentCreatedEvent,
  assignmentEndedEvent,
  equipmentAssignedEvent,
  vehicleAssignedEvent,
} from "@/core/workforce/workforceTimelineEngine";

describe("workforceTimelineEngine", () => {
  it("workerCreatedEvent produces worker_created", () => {
    expect(workerCreatedEvent("Ana Ferreira").type).toBe("worker_created");
  });

  it("workerStatusChangedEvent distinguishes archive/restore from a plain status change", () => {
    expect(workerStatusChangedEvent("Ana", "active", "terminated").type).toBe("worker_archived");
    expect(workerStatusChangedEvent("Ana", "terminated", "active").type).toBe("worker_restored");
    expect(workerStatusChangedEvent("Ana", "active", "on_leave").type).toBe("worker_status_changed");
  });

  it("workerAvailabilityChangedEvent always produces worker_availability_changed", () => {
    expect(workerAvailabilityChangedEvent("Ana", "available").type).toBe("worker_availability_changed");
  });

  it("teamStatusEvent only fires for archived, otherwise returns null", () => {
    expect(teamStatusEvent("Crew", "archived")?.type).toBe("team_archived");
    expect(teamStatusEvent("Crew", "active")).toBeNull();
    expect(teamStatusEvent("Crew", "inactive")).toBeNull();
  });

  it("teamUpdatedEvent produces team_updated", () => {
    expect(teamUpdatedEvent("Crew").type).toBe("team_updated");
  });

  it("workerAddedToTeamEvent produces worker_added_to_team", () => {
    expect(workerAddedToTeamEvent("Ana", "Crew").type).toBe("worker_added_to_team");
  });

  it("assignmentCreatedEvent produces assignment_created", () => {
    expect(assignmentCreatedEvent("Ana", "Event \"Wedding\"").type).toBe("assignment_created");
  });

  it("assignmentEndedEvent distinguishes cancelled from completed", () => {
    expect(assignmentEndedEvent("Ana", "Event", "cancelled").type).toBe("assignment_cancelled");
    expect(assignmentEndedEvent("Ana", "Event", "completed").type).toBe("assignment_ended");
  });

  it("equipmentAssignedEvent/vehicleAssignedEvent describe unassignment when workerName is null", () => {
    expect(equipmentAssignedEvent("Drone", null).description).toMatch(/unassigned/);
    expect(vehicleAssignedEvent("Van", null).description).toMatch(/unassigned/);
    expect(equipmentAssignedEvent("Drone", "Ana").description).toMatch(/assigned to "Ana"/);
  });
});

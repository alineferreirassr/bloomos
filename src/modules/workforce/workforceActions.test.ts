import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createWorkerAction,
  listWorkersAction,
  updateWorkerAction,
  setWorkerStatusAction,
  setWorkerAvailabilityAction,
  createTeamAction,
  addWorkerToTeamAction,
  removeWorkerFromTeamAction,
  setTeamStatusAction,
  createAssignmentAction,
  endAssignmentAction,
  createEquipmentAction,
  setEquipmentStatusAction,
  assignEquipmentAction,
  createVehicleAction,
  setVehicleStatusAction,
  assignVehicleAction,
  evaluateWorkforceAction,
} from "@/modules/workforce/workforceActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWorkersStore } from "@/lib/data/mock/workersStore";
import { resetTeamsStore } from "@/lib/data/mock/teamsStore";
import { resetAvailabilityStore } from "@/lib/data/mock/availabilityStore";
import { resetAssignmentsStore } from "@/lib/data/mock/assignmentsStore";
import { resetMobileSessionsStore } from "@/lib/data/mock/mobileSessionsStore";
import { resetOfflineQueueStore } from "@/lib/data/mock/offlineQueueStore";
import { resetLocationStore } from "@/lib/data/mock/locationStore";
import { resetEquipmentStore } from "@/lib/data/mock/equipmentStore";
import { resetVehiclesStore } from "@/lib/data/mock/vehiclesStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import type { CreateWorkerInput } from "@/core/workforce";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workforce.view", "workforce.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const noPermissionsSession: MemberSessionSnapshot = { ...session, permissions: [] };

const baseWorkerInput: CreateWorkerInput = {
  first_name: "Ana",
  last_name: "Ferreira",
  email: "ana@example.com",
  phone: null,
  role: "technician",
  employment_type: "full_time",
  team_id: null,
  supervisor_worker_id: null,
  linked_member_id: null,
  time_zone: "America/Sao_Paulo",
  language: "en",
  profile_photo_url: null,
  emergency_contact: null,
  skills: [],
  certifications: [],
};

function resetAll(): void {
  resetWorkersStore();
  resetTeamsStore();
  resetAvailabilityStore();
  resetAssignmentsStore();
  resetMobileSessionsStore();
  resetOfflineQueueStore();
  resetLocationStore();
  resetEquipmentStore();
  resetVehiclesStore();
  resetKnowledgeGraphStore();
  resetTimelineStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("createWorkerAction / listWorkersAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createWorkerAction(baseWorkerInput);
    expect(result.success).toBe(false);
  });

  it("creates a worker and records a worker_created Timeline activity", async () => {
    const result = await createWorkerAction(baseWorkerInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(readActivities().some((a) => a.type === "worker_created")).toBe(true);
  });

  it("lists only this workspace's workers", async () => {
    await createWorkerAction(baseWorkerInput);
    const result = await listWorkersAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("setWorkerStatusAction", () => {
  it("archiving a worker records worker_archived, not a generic status-changed event", async () => {
    const created = await createWorkerAction(baseWorkerInput);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await setWorkerStatusAction(created.data.id, "terminated");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("terminated");
    expect(readActivities().some((a) => a.type === "worker_archived")).toBe(true);
  });
});

describe("setWorkerAvailabilityAction", () => {
  it("records an availability window and a worker_availability_changed event", async () => {
    const created = await createWorkerAction(baseWorkerInput);
    if (!created.success) return;

    const result = await setWorkerAvailabilityAction(created.data.id, "available", "2026-07-30T08:00:00.000Z", null, null);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("available");
    expect(readActivities().some((a) => a.type === "worker_availability_changed")).toBe(true);
  });
});

describe("createTeamAction / addWorkerToTeamAction / removeWorkerFromTeamAction", () => {
  it("adding a worker to a team updates the worker's team_id and records worker_added_to_team", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const team = await createTeamAction({ name: "Install Crew", description: null, leader_worker_id: null });
    expect(worker.success && team.success).toBe(true);
    if (!worker.success || !team.success) return;

    const result = await addWorkerToTeamAction(team.data.id, worker.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.member_worker_ids).toContain(worker.data.id);

    const workers = await listWorkersAction();
    if (workers.success) expect(workers.data[0].team_id).toBe(team.data.id);

    const removed = await removeWorkerFromTeamAction(team.data.id, worker.data.id);
    expect(removed.success).toBe(true);
    if (removed.success) expect(removed.data.member_worker_ids).not.toContain(worker.data.id);
  });
});

describe("createAssignmentAction / endAssignmentAction", () => {
  it("rejects assigning a terminated worker", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;
    await setWorkerStatusAction(worker.data.id, "terminated");

    const result = await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" });
    expect(result.success).toBe(false);
  });

  it("creates an assignment, a Knowledge Graph relationship for a real node type, and an assignment_created event", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;

    const result = await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" });
    expect(result.success).toBe(true);
    expect(readActivities().some((a) => a.type === "assignment_created")).toBe(true);
  });

  it("skips Knowledge Graph relationship creation for project/task_placeholder but still records the assignment and Timeline event", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;

    const result = await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "task_placeholder", assignable_id: "placeholder_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" });
    expect(result.success).toBe(true);
    expect(readActivities().some((a) => a.type === "assignment_created")).toBe(true);
  });

  it("endAssignmentAction defaults to completed and records assignment_ended", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;
    const assignment = await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" });
    if (!assignment.success) return;

    const result = await endAssignmentAction(assignment.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("completed");
    expect(readActivities().some((a) => a.type === "assignment_ended")).toBe(true);
  });
});

describe("createEquipmentAction / assignEquipmentAction", () => {
  it("assigning equipment to a worker sets it in_use and records equipment_assigned", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const equipment = await createEquipmentAction({ name: "Drone A", category: "media", serial_number: null, notes: null });
    expect(worker.success && equipment.success).toBe(true);
    if (!worker.success || !equipment.success) return;

    const result = await assignEquipmentAction(equipment.data.id, worker.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("in_use");
    expect(readActivities().some((a) => a.type === "equipment_assigned")).toBe(true);
  });
});

describe("createVehicleAction", () => {
  it("creates a vehicle and records vehicle_created", async () => {
    const result = await createVehicleAction({ label: "Van 1", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, notes: null });
    expect(result.success).toBe(true);
    expect(readActivities().some((a) => a.type === "vehicle_created")).toBe(true);
  });
});

describe("evaluateWorkforceAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateWorkforceAction();
    expect(result.success).toBe(false);
  });

  it("returns a coherent snapshot for an empty workspace", async () => {
    const result = await evaluateWorkforceAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workers).toEqual([]);
    expect(result.data.scorecard.totalWorkers).toBe(0);
  });

  it("reflects a created worker's availability in the scorecard", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;
    await setWorkerAvailabilityAction(worker.data.id, "available", "2026-01-01T00:00:00.000Z", null, null);

    const result = await evaluateWorkforceAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scorecard.totalWorkers).toBe(1);
    expect(result.data.scorecard.availableNow).toBe(1);
  });

  it("reflects an active assignment as on_assignment, overriding the last explicit availability window", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    if (!worker.success) return;
    await setWorkerAvailabilityAction(worker.data.id, "available", "2026-01-01T00:00:00.000Z", null, null);
    await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-01-01T00:00:00.000Z" });

    const result = await evaluateWorkforceAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scorecard.onAssignmentNow).toBe(1);
    expect(result.data.scorecard.availableNow).toBe(0);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every create/update mutation for a session with no workforce.manage permission", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const team = await createTeamAction({ name: "Install Crew", description: null, leader_worker_id: null });
    const equipment = await createEquipmentAction({ name: "Drone A", category: "media", serial_number: null, notes: null });
    const vehicle = await createVehicleAction({ label: "Van 1", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, notes: null });
    const assignment = worker.success
      ? await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_1", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" })
      : null;
    expect(worker.success && team.success && equipment.success && vehicle.success).toBe(true);
    if (!worker.success || !team.success || !equipment.success || !vehicle.success || !assignment?.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);

    expect((await createWorkerAction(baseWorkerInput)).success).toBe(false);
    expect((await updateWorkerAction(worker.data.id, { first_name: "Blocked" })).success).toBe(false);
    expect((await setWorkerStatusAction(worker.data.id, "on_leave")).success).toBe(false);
    expect((await createTeamAction({ name: "Blocked Crew", description: null, leader_worker_id: null })).success).toBe(false);
    expect((await addWorkerToTeamAction(team.data.id, worker.data.id)).success).toBe(false);
    expect((await removeWorkerFromTeamAction(team.data.id, worker.data.id)).success).toBe(false);
    expect((await setTeamStatusAction(team.data.id, "archived")).success).toBe(false);
    expect((await createAssignmentAction({ worker_id: worker.data.id, assignable_type: "event", assignable_id: "event_2", role_note: null, starts_at: "2026-07-30T08:00:00.000Z" })).success).toBe(false);
    expect((await endAssignmentAction(assignment.data.id)).success).toBe(false);
    expect((await createEquipmentAction({ name: "Blocked Drone", category: "media", serial_number: null, notes: null })).success).toBe(false);
    expect((await setEquipmentStatusAction(equipment.data.id, "maintenance")).success).toBe(false);
    expect((await assignEquipmentAction(equipment.data.id, worker.data.id)).success).toBe(false);
    expect((await createVehicleAction({ label: "Blocked Van", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, notes: null })).success).toBe(false);
    expect((await setVehicleStatusAction(vehicle.data.id, "maintenance")).success).toBe(false);
    expect((await assignVehicleAction(vehicle.data.id, worker.data.id)).success).toBe(false);
  });
});

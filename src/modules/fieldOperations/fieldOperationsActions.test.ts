import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  buildFieldOperationAction,
  listFieldOperationsAction,
  getFieldOperationAction,
  evaluateFieldOperationAction,
  startSessionAction,
  pauseSessionAction,
  resumeSessionAction,
  completeSessionAction,
  cancelSessionAction,
  abortSessionAction,
  failSessionAction,
  archiveSessionAction,
  restartFieldOperationAction,
  updateSessionProgressAction,
  evaluateFieldOperationsPlatformHealthAction,
  fieldOperationsRecommendationsForExecutiveDecisions,
  type BuildFieldOperationInput,
} from "@/modules/fieldOperations/fieldOperationsActions";
import { buildDispatchOrderAction, assignDispatchAssignmentAction, presentDispatchAssignmentAction, acceptDispatchAssignmentAction, dispatchOrderAction, type BuildDispatchOrderInput } from "@/modules/dispatch/dispatchActions";
import { buildExecutionPackageAction, approveExecutionPackageAction, type BuildExecutionPackageInput } from "@/modules/executionPackage/executionPackageActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetFieldOperationsStore } from "@/lib/data/mock/fieldOperationsStore";
import { resetDispatchOrdersStore } from "@/lib/data/mock/dispatchOrdersStore";
import { resetDispatchBatchesStore } from "@/lib/data/mock/dispatchBatchesStore";
import { resetExecutionPackagesStore } from "@/lib/data/mock/executionPackagesStore";
import { resetOperationalPlansStore, mockOperationalPlansRepository } from "@/lib/data/mock/operationalPlansStore";
import { resetCalendarsStore, mockCalendarsRepository } from "@/lib/data/mock/calendarsStore";
import { resetAppointmentsStore, mockAppointmentsRepository } from "@/lib/data/mock/appointmentsStore";
import { resetAllocationRequestsStore, mockAllocationRequestsRepository } from "@/lib/data/mock/allocationRequestsStore";
import { resetAllocationsStore, mockAllocationsRepository } from "@/lib/data/mock/allocationsStore";
import { resetWorkersStore, mockWorkersRepository } from "@/lib/data/mock/workersStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import type { ExecutionPhase } from "@/types/operationalPlanning";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["execution_packages.view", "execution_packages.manage", "dispatch.manage", "field_operations.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const PHASES: ExecutionPhase[] = [
  {
    id: "phase_1",
    kind: "setup",
    name: "Setup",
    order: 1,
    steps: [{ id: "step_1", title: "Position floral arch", description: null, instructions: "Position the arch facing the sea.", estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: "capability_requirement_1", priority: "medium", status: "pending", notes: null }],
  },
];

async function seedWorker() {
  const result = await mockWorkersRepository.createWorker("ws_1", {
    first_name: "Sofia",
    last_name: "Reyes",
    email: "sofia@amorebloom.com",
    phone: null,
    role: "crew_member",
    employment_type: "full_time",
    team_id: null,
    supervisor_worker_id: null,
    linked_member_id: null,
    time_zone: "UTC",
    language: "en",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [],
    certifications: [],
  });
  if (!result.success) throw new Error("failed to seed worker");
  return result.data;
}

async function seedPlan() {
  const result = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", {
    name: "Amoré Wedding — Setup Plan",
    template_id: null,
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    phases: PHASES,
    milestones: [],
    deliverables: [],
    evidence_requirements: [],
    checklists: [],
    approvals: [],
  });
  if (!result.success) throw new Error("failed to seed plan");
  return result.data;
}

async function seedAllocation(workerId: string) {
  const requestResult = await mockAllocationRequestsRepository.createRequest("ws_1", "member_1", {
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }],
    required_starts_at: "2026-02-01T09:00:00.000Z",
    required_ends_at: "2026-02-01T12:00:00.000Z",
    calendar_id: null,
    priority: "medium",
    deadline: null,
    location_placeholder: "123 Ocean Drive",
    special_instructions: "Gate code is 4471.",
    bundle_id: null,
    source: "manual",
  });
  if (!requestResult.success) throw new Error("failed to seed allocation request");

  const allocationResult = await mockAllocationsRepository.createAllocation("ws_1", "member_1", {
    request_id: requestResult.data.id,
    group_id: "group_1",
    strategy: "highest_capability",
    candidates: [{ resource_type: "worker", resource_id: workerId, requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }],
  });
  if (!allocationResult.success) throw new Error("failed to seed allocation");
  return allocationResult.data;
}

async function seedAppointment() {
  const calendarResult = await mockCalendarsRepository.createCalendar("ws_1", "member_1", { name: "Main Calendar", description: null, context_type: "workspace", context: null, time_zone: "UTC" });
  if (!calendarResult.success) throw new Error("failed to seed calendar");

  const appointmentResult = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", {
    calendar_id: calendarResult.data.id,
    title: "Wedding Setup",
    starts_at: "2026-02-01T09:00:00.000Z",
    ends_at: "2026-02-01T12:00:00.000Z",
    priority: "medium",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    client_id: null,
    worker_id: null,
    location_placeholder: "123 Ocean Drive",
    preparation_minutes: 30,
    cleanup_minutes: 30,
    notes: null,
    recurrence_rule_id: null,
  });
  if (!appointmentResult.success) throw new Error("failed to seed appointment");
  return appointmentResult.data;
}

function basePackageInput(overrides: Partial<BuildExecutionPackageInput> = {}): BuildExecutionPackageInput {
  return { operationalPlanId: "plan_missing", allocationId: null, appointmentId: null, customer: null, priorityOverride: null, notes: null, tags: [], dependencyChecks: [], reason: null, ...overrides };
}

function baseDispatchInput(overrides: Partial<BuildDispatchOrderInput> = {}): BuildDispatchOrderInput {
  return { executionPackageId: "package_missing", batchId: null, priorityOverride: null, source: "execution_package_derived", ...overrides };
}

/** Builds a Field Operation all the way from real Worker/Plan/Allocation/Appointment/Execution Package/Dispatch Order/accepted Assignment — the exact real chain `buildFieldOperationAction` reads through. */
async function seedFieldOperationReady() {
  const worker = await seedWorker();
  const plan = await seedPlan();
  const allocation = await seedAllocation(worker.id);
  const appointment = await seedAppointment();

  const built = await buildExecutionPackageAction(basePackageInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
  if (!built.success) throw new Error("failed to build execution package");
  const approved = await approveExecutionPackageAction(built.data.id);
  if (!approved.success) throw new Error("failed to approve execution package");

  const order = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: approved.data.id }));
  if (!order.success) throw new Error("failed to build dispatch order");
  const assignmentId = order.data.assignments[0].id;

  const assigned = await assignDispatchAssignmentAction(order.data.id, assignmentId);
  if (!assigned.success) throw new Error("failed to assign");
  const presented = await presentDispatchAssignmentAction(order.data.id, assignmentId);
  if (!presented.success) throw new Error("failed to present");
  const accepted = await acceptDispatchAssignmentAction(order.data.id, assignmentId);
  if (!accepted.success) throw new Error("failed to accept");
  const dispatched = await dispatchOrderAction(order.data.id);
  if (!dispatched.success) throw new Error("failed to dispatch order");

  return { order: dispatched.data, assignmentId, worker };
}

function baseFieldOperationInput(overrides: Partial<BuildFieldOperationInput> = {}): BuildFieldOperationInput {
  return { dispatchOrderId: "dispatch_order_missing", dispatchAssignmentId: "assignment_missing", ...overrides };
}

beforeEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  resetFieldOperationsStore();
  resetDispatchOrdersStore();
  resetDispatchBatchesStore();
  resetExecutionPackagesStore();
  resetOperationalPlansStore();
  resetCalendarsStore();
  resetAppointmentsStore();
  resetAllocationRequestsStore();
  resetAllocationsStore();
  resetWorkersStore();
  resetTimelineStore();
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

describe("buildFieldOperationAction", () => {
  it("builds a field operation from an accepted dispatch assignment and an approved package", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const result = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0].lifecycle_state).toBe("created");

    // No Timeline event on build — the spec's own 7 named events begin at "Execution Started."
    const activities = readActivities();
    expect(activities.filter((a) => a.type.startsWith("execution_"))).toHaveLength(0);
  });

  it("rejects when the dispatch assignment hasn't been accepted yet", async () => {
    const worker = await seedWorker();
    const plan = await seedPlan();
    const allocation = await seedAllocation(worker.id);
    const appointment = await seedAppointment();
    const built = await buildExecutionPackageAction(basePackageInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
    if (!built.success) throw new Error("failed to build package");
    const approved = await approveExecutionPackageAction(built.data.id);
    if (!approved.success) throw new Error("failed to approve package");
    const order = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: approved.data.id }));
    if (!order.success) throw new Error("failed to build order");

    const result = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.data.id, dispatchAssignmentId: order.data.assignments[0].id }));
    expect(result.success).toBe(false);
  });
});

describe("listFieldOperationsAction / getFieldOperationAction", () => {
  it("lists operations for the workspace and fetches one by id", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const list = await listFieldOperationsAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);

    const fetched = await getFieldOperationAction(built.data.id);
    expect(fetched.success).toBe(true);
    if (fetched.success) expect(fetched.data.id).toBe(built.data.id);
  });

  it("errors for an operation that doesn't exist", async () => {
    const result = await getFieldOperationAction("field_operation_missing");
    expect(result.success).toBe(false);
  });
});

describe("evaluateFieldOperationAction", () => {
  it("evaluates a freshly built operation as valid, with a fresh created session", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const evaluated = await evaluateFieldOperationAction(built.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.validation.valid).toBe(true);
      expect(evaluated.data.progress.remainingStepIds).toEqual(["step_1"]);
      expect(evaluated.data.state.currentState).toBe("created");
    }
  });
});

describe("startSessionAction / pauseSessionAction / resumeSessionAction", () => {
  it("starts a valid session and records execution_started", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const result = await startSessionAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sessions[0].lifecycle_state).toBe("started");

    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_started")).toBe(true);
  });

  it("pauses a started session with a reason and records execution_paused", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);

    const result = await pauseSessionAction(built.data.id, "Weather delay");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions[0].lifecycle_state).toBe("paused");
      expect(result.data.sessions[0].reason).toBe("Weather delay");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_paused")).toBe(true);
  });

  it("resumes a paused session and records execution_resumed", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);
    await pauseSessionAction(built.data.id, "Weather delay");

    const result = await resumeSessionAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sessions[0].lifecycle_state).toBe("resumed");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_resumed")).toBe(true);
  });
});

describe("completeSessionAction", () => {
  it("rejects completion while steps remain", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);

    const result = await completeSessionAction(built.data.id);
    expect(result.success).toBe(false);
  });

  it("completes once every step is marked done, and sets the operation status to completed", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);
    await updateSessionProgressAction(built.data.id, { completed_step_ids: ["step_1"] });

    const result = await completeSessionAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("completed");
      expect(result.data.sessions[0].lifecycle_state).toBe("completed");
      expect(result.data.sessions[0].outcome).toBe("completed");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_completed")).toBe(true);
  });
});

describe("cancelSessionAction / abortSessionAction / failSessionAction", () => {
  it("cancels a session with a reason and sets the operation status to cancelled", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const result = await cancelSessionAction(built.data.id, "Client rescheduled");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("cancelled");
      expect(result.data.sessions[0].outcome).toBe("cancelled");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_cancelled")).toBe(true);
  });

  it("aborts an active session and records execution_failed (no dedicated abort event)", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);

    const result = await abortSessionAction(built.data.id, "Safety hazard");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sessions[0].outcome).toBe("aborted");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_failed")).toBe(true);
  });

  it("fails an active session with a reason and records execution_failed", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);

    const result = await failSessionAction(built.data.id, "Equipment malfunction");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions[0].outcome).toBe("failed");
      expect(result.data.sessions[0].reason).toBe("Equipment malfunction");
    }
  });
});

describe("archiveSessionAction / restartFieldOperationAction", () => {
  it("archives a terminal session and files the whole operation away", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await cancelSessionAction(built.data.id, "Client rescheduled");

    const result = await archiveSessionAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions[0].lifecycle_state).toBe("archived");
      expect(result.data.status).toBe("archived");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "execution_archived")).toBe(true);
  });

  it("rejects archiving an active session", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await startSessionAction(built.data.id);

    const result = await archiveSessionAction(built.data.id);
    expect(result.success).toBe(false);
  });

  it("restarts a field operation after a cancelled session, appending a fresh session", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");
    await cancelSessionAction(built.data.id, "Retry needed");

    const restarted = await restartFieldOperationAction(built.data.id);
    expect(restarted.success).toBe(true);
    if (restarted.success) {
      expect(restarted.data.sessions).toHaveLength(2);
      expect(restarted.data.sessions[0].lifecycle_state).toBe("cancelled");
      expect(restarted.data.sessions[1].lifecycle_state).toBe("created");
    }
  });

  it("rejects restarting a field operation whose current session is still active", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const result = await restartFieldOperationAction(built.data.id);
    expect(result.success).toBe(false);
  });
});

describe("updateSessionProgressAction", () => {
  it("updates the current session's progress overlay without changing its lifecycle_state", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const result = await updateSessionProgressAction(built.data.id, { current_phase_id: "phase_1", completed_step_ids: ["step_1"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessions[0].completed_step_ids).toEqual(["step_1"]);
      expect(result.data.sessions[0].lifecycle_state).toBe("created");
    }
  });
});

describe("evaluateFieldOperationsPlatformHealthAction / fieldOperationsRecommendationsForExecutiveDecisions", () => {
  it("returns results and findings across every operation in the workspace", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const result = await evaluateFieldOperationsPlatformHealthAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.findings.some((f) => f.type === "execution_healthy")).toBe(true);
    }
  });

  it("translates findings into recommendations for Executive Decisions", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const recommendations = await fieldOperationsRecommendationsForExecutiveDecisions();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r.ruleId.startsWith("field_operations."))).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating action for a session lacking field_operations.manage", async () => {
    const { order, assignmentId } = await seedFieldOperationReady();
    const built = await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build field operation");

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["field_operations.view", "execution_packages.view", "execution_packages.manage", "dispatch.manage"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await buildFieldOperationAction(baseFieldOperationInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }))).success).toBe(false);
    expect((await startSessionAction(built.data.id)).success).toBe(false);
    expect((await pauseSessionAction(built.data.id)).success).toBe(false);
    expect((await resumeSessionAction(built.data.id)).success).toBe(false);
    expect((await completeSessionAction(built.data.id)).success).toBe(false);
    expect((await cancelSessionAction(built.data.id, "Blocked")).success).toBe(false);
    expect((await abortSessionAction(built.data.id, "Blocked")).success).toBe(false);
    expect((await failSessionAction(built.data.id, "Blocked")).success).toBe(false);
    expect((await archiveSessionAction(built.data.id)).success).toBe(false);
    expect((await restartFieldOperationAction(built.data.id)).success).toBe(false);
    expect((await updateSessionProgressAction(built.data.id, { current_phase_id: "phase_1" })).success).toBe(false);
  });
});

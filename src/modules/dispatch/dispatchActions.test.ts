import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  buildDispatchOrderAction,
  listDispatchOrdersAction,
  getDispatchOrderAction,
  evaluateDispatchOrderAction,
  assignDispatchAssignmentAction,
  presentDispatchAssignmentAction,
  acceptDispatchAssignmentAction,
  declineDispatchAssignmentAction,
  cancelDispatchOrderAction,
  archiveDispatchOrderAction,
  createDispatchBatchAction,
  listDispatchBatchesAction,
  evaluateDispatchPlatformHealthAction,
  dispatchRecommendationsForExecutiveDecisions,
  type BuildDispatchOrderInput,
} from "@/modules/dispatch/dispatchActions";
import { buildExecutionPackageAction, approveExecutionPackageAction, type BuildExecutionPackageInput } from "@/modules/executionPackage/executionPackageActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
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
  permissions: ["execution_packages.view", "execution_packages.manage", "dispatch.manage"],
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

/** Builds and approves a ready Execution Package with one selected worker candidate — the minimum a Dispatch Order can legally be built from. */
async function seedApprovedReadyPackage() {
  const worker = await seedWorker();
  const plan = await seedPlan();
  const allocation = await seedAllocation(worker.id);
  const appointment = await seedAppointment();

  const built = await buildExecutionPackageAction(basePackageInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
  if (!built.success) throw new Error("failed to build execution package");

  const approved = await approveExecutionPackageAction(built.data.id);
  if (!approved.success) throw new Error("failed to approve execution package");

  return { pkg: approved.data, worker };
}

function baseDispatchInput(overrides: Partial<BuildDispatchOrderInput> = {}): BuildDispatchOrderInput {
  return { executionPackageId: "package_missing", batchId: null, priorityOverride: null, source: "execution_package_derived", ...overrides };
}

beforeEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
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

describe("buildDispatchOrderAction", () => {
  it("builds a dispatch order from an approved, ready execution package and records Timeline events", async () => {
    const { pkg, worker } = await seedApprovedReadyPackage();

    const result = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.assignments).toHaveLength(1);
    expect(result.data.assignments[0].resource_type).toBe("worker");
    expect(result.data.assignments[0].resource_id).toBe(worker.id);
    expect(result.data.assignments[0].queue_state).toBe("queued");

    const activities = readActivities();
    expect(activities.some((a) => a.type === "dispatch_created")).toBe(true);
    expect(activities.some((a) => a.type === "dispatch_assignment_created")).toBe(true);
  });

  it("rejects a package that has not been approved", async () => {
    const worker = await seedWorker();
    const plan = await seedPlan();
    const allocation = await seedAllocation(worker.id);
    const appointment = await seedAppointment();
    const built = await buildExecutionPackageAction(basePackageInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
    if (!built.success) throw new Error("failed to build execution package");

    const result = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: built.data.id }));
    expect(result.success).toBe(false);
  });

  it("rejects a package that is approved but not ready (missing allocation/schedule)", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(basePackageInput({ operationalPlanId: plan.id }));
    if (!built.success) throw new Error("failed to build execution package");

    const result = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: built.data.id }));
    expect(result.success).toBe(false);
  });
});

describe("listDispatchOrdersAction / getDispatchOrderAction", () => {
  it("lists orders for the workspace and fetches one by id", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const list = await listDispatchOrdersAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);

    const fetched = await getDispatchOrderAction(built.data.id);
    expect(fetched.success).toBe(true);
    if (fetched.success) expect(fetched.data.id).toBe(built.data.id);
  });

  it("errors for an order that doesn't exist", async () => {
    const result = await getDispatchOrderAction("dispatch_order_missing");
    expect(result.success).toBe(false);
  });
});

describe("evaluateDispatchOrderAction", () => {
  it("evaluates a freshly built order as valid with an active worker and active schedule", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const evaluated = await evaluateDispatchOrderAction(built.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.validation.valid).toBe(true);
      expect(evaluated.data.health.assignmentCoverage).toBe(0);
    }
  });
});

describe("assignDispatchAssignmentAction / presentDispatchAssignmentAction", () => {
  it("advances a fresh assignment from queued through assigned to pending", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;

    const assigned = await assignDispatchAssignmentAction(built.data.id, assignmentId);
    expect(assigned.success).toBe(true);
    if (assigned.success) expect(assigned.data.assignments[0].queue_state).toBe("assigned");

    const presented = await presentDispatchAssignmentAction(built.data.id, assignmentId);
    expect(presented.success).toBe(true);
    if (presented.success) expect(presented.data.assignments[0].queue_state).toBe("pending");
  });

  it("rejects presenting an assignment that hasn't been assigned yet", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;

    const result = await presentDispatchAssignmentAction(built.data.id, assignmentId);
    expect(result.success).toBe(false);
  });
});

async function advanceToPending(orderId: string, assignmentId: string) {
  const assigned = await assignDispatchAssignmentAction(orderId, assignmentId);
  if (!assigned.success) throw new Error("failed to assign");
  const presented = await presentDispatchAssignmentAction(orderId, assignmentId);
  if (!presented.success) throw new Error("failed to present");
}

describe("acceptDispatchAssignmentAction / declineDispatchAssignmentAction", () => {
  it("accepts a pending assignment and records assignment_accepted + queue_updated", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;
    await advanceToPending(built.data.id, assignmentId);

    const result = await acceptDispatchAssignmentAction(built.data.id, assignmentId);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assignments[0].queue_state).toBe("accepted");

    const activities = readActivities();
    expect(activities.some((a) => a.type === "assignment_accepted")).toBe(true);
    expect(activities.some((a) => a.type === "queue_updated")).toBe(true);
  });

  it("declines a pending assignment with a reason and records assignment_declined", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;
    await advanceToPending(built.data.id, assignmentId);

    const result = await declineDispatchAssignmentAction(built.data.id, assignmentId, "Not available");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignments[0].queue_state).toBe("declined");
      expect(result.data.assignments[0].reason).toBe("Not available");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "assignment_declined")).toBe(true);
  });

  it("rejects an accept once the assignment has already been declined (terminal state)", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;
    await advanceToPending(built.data.id, assignmentId);

    await declineDispatchAssignmentAction(built.data.id, assignmentId, "Not available");
    const result = await acceptDispatchAssignmentAction(built.data.id, assignmentId);
    expect(result.success).toBe(false);
  });

  it("rejects an accept while the assignment is still queued (no shortcutting the queue)", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");
    const assignmentId = built.data.assignments[0].id;

    const result = await acceptDispatchAssignmentAction(built.data.id, assignmentId);
    expect(result.success).toBe(false);
  });
});

describe("cancelDispatchOrderAction / archiveDispatchOrderAction", () => {
  it("cancels an order and records dispatch_cancelled", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const result = await cancelDispatchOrderAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "dispatch_cancelled")).toBe(true);
  });

  it("archives an order and records dispatch_archived", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const result = await archiveDispatchOrderAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "dispatch_archived")).toBe(true);
  });
});

describe("createDispatchBatchAction / listDispatchBatchesAction", () => {
  it("creates a batch referencing real orders and lists it back", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const created = await createDispatchBatchAction({ name: "Morning Wave", orderIds: [built.data.id] });
    expect(created.success).toBe(true);

    const list = await listDispatchBatchesAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);
  });
});

describe("evaluateDispatchPlatformHealthAction / dispatchRecommendationsForExecutiveDecisions", () => {
  it("returns results and findings across all orders in the workspace", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const result = await evaluateDispatchPlatformHealthAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.findings.some((f) => f.type === "dispatch_ready")).toBe(true);
    }
  });

  it("translates findings into recommendations for Executive Decisions", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    if (!built.success) throw new Error("failed to build dispatch order");

    const recommendations = await dispatchRecommendationsForExecutiveDecisions();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r.ruleId.startsWith("dispatch."))).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutation for a session with no dispatch.manage permission", async () => {
    const { pkg } = await seedApprovedReadyPackage();
    const built = await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }));
    expect(built.success).toBe(true);
    if (!built.success) return;
    const assignmentId = built.data.assignments[0].id;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["execution_packages.view", "execution_packages.manage"] });

    expect((await buildDispatchOrderAction(baseDispatchInput({ executionPackageId: pkg.id }))).success).toBe(false);
    expect((await assignDispatchAssignmentAction(built.data.id, assignmentId)).success).toBe(false);
    expect((await presentDispatchAssignmentAction(built.data.id, assignmentId)).success).toBe(false);
    expect((await acceptDispatchAssignmentAction(built.data.id, assignmentId)).success).toBe(false);
    expect((await declineDispatchAssignmentAction(built.data.id, assignmentId, "unavailable")).success).toBe(false);
    expect((await cancelDispatchOrderAction(built.data.id)).success).toBe(false);
    expect((await archiveDispatchOrderAction(built.data.id)).success).toBe(false);
    expect((await createDispatchBatchAction({ name: "Blocked Batch", orderIds: [built.data.id] })).success).toBe(false);
  });
});

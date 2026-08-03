import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  buildRoutePlanAction,
  listRoutePlansAction,
  getRoutePlanAction,
  evaluateRoutePlanAction,
  optimizeRoutePlanAction,
  validateRoutePlanAction,
  approveRoutePlanAction,
  archiveRoutePlanAction,
  evaluateRouteOptimizationPlatformHealthAction,
  routeOptimizationRecommendationsForExecutiveDecisions,
  type BuildRoutePlanInput,
} from "@/modules/routeOptimization/routeOptimizationActions";
import { buildDispatchOrderAction, assignDispatchAssignmentAction, presentDispatchAssignmentAction, acceptDispatchAssignmentAction, dispatchOrderAction, type BuildDispatchOrderInput } from "@/modules/dispatch/dispatchActions";
import { buildExecutionPackageAction, approveExecutionPackageAction, type BuildExecutionPackageInput } from "@/modules/executionPackage/executionPackageActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetRouteOptimizationStore } from "@/lib/data/mock/routeOptimizationStore";
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
  permissions: ["execution_packages.view", "execution_packages.manage", "dispatch.manage", "route_optimization.manage"],
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

/** Builds a Route Plan all the way from real Worker/Plan/Allocation/Appointment/Execution Package/Dispatch Order/accepted+dispatched Assignment — the exact real chain `buildRoutePlanAction` reads through. */
async function seedRoutePlanReady() {
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

function baseRoutePlanInput(overrides: Partial<BuildRoutePlanInput> = {}): BuildRoutePlanInput {
  return { dispatchOrderId: "dispatch_order_missing", dispatchAssignmentId: "assignment_missing", ...overrides };
}

beforeEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  resetRouteOptimizationStore();
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

describe("buildRoutePlanAction", () => {
  it("builds a route plan from an accepted dispatch assignment and an approved package, with one origin/stop/destination waypoint", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const result = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.versions).toHaveLength(1);
    expect(result.data.versions[0].snapshot.waypoints).toHaveLength(3);
    expect(result.data.versions[0].snapshot.optimization_result).toBeNull();

    const activities = readActivities();
    expect(activities.some((a) => a.type === "route_created")).toBe(true);
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

    const result = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.data.id, dispatchAssignmentId: order.data.assignments[0].id }));
    expect(result.success).toBe(false);
  });
});

describe("listRoutePlansAction / getRoutePlanAction", () => {
  it("lists route plans for the workspace and fetches one by id", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const list = await listRoutePlansAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);

    const fetched = await getRoutePlanAction(built.data.id);
    expect(fetched.success).toBe(true);
    if (fetched.success) expect(fetched.data.id).toBe(built.data.id);
  });

  it("errors for a route plan that doesn't exist", async () => {
    const result = await getRoutePlanAction("route_plan_missing");
    expect(result.success).toBe(false);
  });
});

describe("evaluateRoutePlanAction", () => {
  it("evaluates a freshly built route plan as valid, with no optimization yet", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const evaluated = await evaluateRoutePlanAction(built.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.validation.valid).toBe(true);
      expect(evaluated.data.optimization).toBeNull();
      expect(evaluated.data.travelEstimate.estimatedTravelMinutes).toBe(0);
    }
  });
});

describe("optimizeRoutePlanAction", () => {
  it("optimizes for the first time, appends a version, and records route_optimized", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const result = await optimizeRoutePlanAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.versions).toHaveLength(2);
      expect(result.data.versions[1].snapshot.optimization_result).not.toBeNull();
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "route_optimized")).toBe(true);
    expect(activities.some((a) => a.type === "optimization_recalculated")).toBe(false);
  });

  it("records optimization_recalculated on every subsequent optimization", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");
    await optimizeRoutePlanAction(built.data.id);

    const result = await optimizeRoutePlanAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.versions).toHaveLength(3);
    const activities = readActivities();
    expect(activities.some((a) => a.type === "optimization_recalculated")).toBe(true);
  });
});

describe("validateRoutePlanAction / approveRoutePlanAction / archiveRoutePlanAction", () => {
  it("validates a valid route plan, moves status to validated, and records route_validated", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const result = await validateRoutePlanAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("validated");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "route_validated")).toBe(true);
  });

  it("rejects approval before validation", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const result = await approveRoutePlanAction(built.data.id);
    expect(result.success).toBe(false);
  });

  it("approves a validated route plan and records route_approved", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");
    await validateRoutePlanAction(built.data.id);

    const result = await approveRoutePlanAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("approved");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "route_approved")).toBe(true);
  });

  it("archives a route plan and records route_archived", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const result = await archiveRoutePlanAction(built.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "route_archived")).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating route plan action for a session lacking route_optimization.manage", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");
    await validateRoutePlanAction(built.data.id);

    const noManageSession: MemberSessionSnapshot = { ...session, permissions: ["route_optimization.view", "execution_packages.view", "execution_packages.manage", "dispatch.manage"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noManageSession);

    const buildResult = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    expect(buildResult.success).toBe(false);

    const optimizeResult = await optimizeRoutePlanAction(built.data.id);
    expect(optimizeResult.success).toBe(false);

    const validateResult = await validateRoutePlanAction(built.data.id);
    expect(validateResult.success).toBe(false);

    const approveResult = await approveRoutePlanAction(built.data.id);
    expect(approveResult.success).toBe(false);

    const archiveResult = await archiveRoutePlanAction(built.data.id);
    expect(archiveResult.success).toBe(false);
  });
});

describe("evaluateRouteOptimizationPlatformHealthAction / routeOptimizationRecommendationsForExecutiveDecisions", () => {
  it("returns results and findings across every route plan in the workspace", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const result = await evaluateRouteOptimizationPlatformHealthAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.findings.some((f) => f.type === "optimization_opportunity")).toBe(true);
    }
  });

  it("translates findings into recommendations for Executive Decisions", async () => {
    const { order, assignmentId } = await seedRoutePlanReady();
    const built = await buildRoutePlanAction(baseRoutePlanInput({ dispatchOrderId: order.id, dispatchAssignmentId: assignmentId }));
    if (!built.success) throw new Error("failed to build route plan");

    const recommendations = await routeOptimizationRecommendationsForExecutiveDecisions();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r.ruleId.startsWith("route_optimization."))).toBe(true);
  });
});

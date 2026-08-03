import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  buildExecutionPackageAction,
  listExecutionPackagesAction,
  getExecutionPackageAction,
  createExecutionPackageVersionAction,
  evaluateExecutionPackageAction,
  validateExecutionPackageAction,
  approveExecutionPackageAction,
  archiveExecutionPackageAction,
  compareExecutionPackageVersionsAction,
  evaluateExecutionPackagePlatformHealthAction,
  executionPackageRecommendationsForExecutiveDecisions,
  type BuildExecutionPackageInput,
} from "@/modules/executionPackage/executionPackageActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetExecutionPackagesStore } from "@/lib/data/mock/executionPackagesStore";
import { resetOperationalPlansStore, mockOperationalPlansRepository } from "@/lib/data/mock/operationalPlansStore";
import { resetCalendarsStore, mockCalendarsRepository } from "@/lib/data/mock/calendarsStore";
import { resetAppointmentsStore, mockAppointmentsRepository } from "@/lib/data/mock/appointmentsStore";
import { resetAllocationRequestsStore, mockAllocationRequestsRepository } from "@/lib/data/mock/allocationRequestsStore";
import { resetAllocationsStore, mockAllocationsRepository } from "@/lib/data/mock/allocationsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import type { ExecutionPhase } from "@/types/operationalPlanning";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["operational_planning.view", "operational_planning.manage", "execution_packages.view", "execution_packages.manage"],
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

async function seedPlan(overrides: { context?: { nodeType: "event"; nodeId: string } } = {}) {
  const result = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", {
    name: "Amoré Wedding — Setup Plan",
    template_id: null,
    context_type: "event",
    context: overrides.context ?? { nodeType: "event", nodeId: "event_1" },
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

async function seedAllocation() {
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
    candidates: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }],
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

function baseBuildInput(overrides: Partial<BuildExecutionPackageInput> = {}): BuildExecutionPackageInput {
  return { operationalPlanId: "plan_missing", allocationId: null, appointmentId: null, customer: null, priorityOverride: null, notes: null, tags: [], dependencyChecks: [], reason: null, ...overrides };
}

beforeEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  resetExecutionPackagesStore();
  resetOperationalPlansStore();
  resetCalendarsStore();
  resetAppointmentsStore();
  resetAllocationRequestsStore();
  resetAllocationsStore();
  resetTimelineStore();
});

afterEach(() => {
  vi.mocked(resolveMemberSessionSnapshot).mockReset();
});

describe("buildExecutionPackageAction", () => {
  it("builds a package with a full snapshot when plan, allocation, and appointment all exist", async () => {
    const plan = await seedPlan();
    const allocation = await seedAllocation();
    const appointment = await seedAppointment();

    const result = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.versions).toHaveLength(1);
    const snapshot = result.data.versions[0].snapshot;
    expect(snapshot.operational_plan_id).toBe(plan.id);
    expect(snapshot.allocation_id).toBe(allocation.id);
    expect(snapshot.appointment_id).toBe(appointment.id);
    expect(snapshot.phases).toEqual(PHASES);
    expect(result.data.context.location_placeholder).toBe("123 Ocean Drive");

    const activities = readActivities();
    expect(activities.some((a) => a.type === "package_created")).toBe(true);
    expect(activities.some((a) => a.type === "snapshot_created")).toBe(true);
  });

  it("errors when the operational plan doesn't exist", async () => {
    const result = await buildExecutionPackageAction(baseBuildInput());
    expect(result.success).toBe(false);
  });

  it("builds a package with no allocation/appointment when neither is supplied", async () => {
    const plan = await seedPlan();
    const result = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.versions[0].snapshot.allocation_id).toBeNull();
    expect(result.data.versions[0].snapshot.appointment_id).toBeNull();
  });
});

describe("listExecutionPackagesAction / getExecutionPackageAction", () => {
  it("lists packages for the workspace and fetches one by id", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const list = await listExecutionPackagesAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);

    const fetched = await getExecutionPackageAction(built.data.id);
    expect(fetched.success).toBe(true);
    if (fetched.success) expect(fetched.data.id).toBe(built.data.id);
  });

  it("errors for a package that doesn't exist", async () => {
    const result = await getExecutionPackageAction("execution_package_missing");
    expect(result.success).toBe(false);
  });
});

describe("createExecutionPackageVersionAction", () => {
  it("appends a new immutable version and records snapshot_created + version_created", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const allocation = await seedAllocation();
    const versioned = await createExecutionPackageVersionAction(built.data.id, baseBuildInput({ operationalPlanId: plan.id, allocationId: allocation.id, reason: "Allocation resolved" }));
    expect(versioned.success).toBe(true);
    if (versioned.success) {
      expect(versioned.data.versions).toHaveLength(2);
      expect(versioned.data.versions[1].reason).toBe("Allocation resolved");
    }

    const activities = readActivities();
    expect(activities.filter((a) => a.type === "snapshot_created")).toHaveLength(2);
    expect(activities.some((a) => a.type === "version_created")).toBe(true);
  });
});

describe("evaluateExecutionPackageAction / validateExecutionPackageAction", () => {
  it("evaluates a complete package as valid and ready", async () => {
    const plan = await seedPlan();
    const allocation = await seedAllocation();
    const appointment = await seedAppointment();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
    if (!built.success) return;

    const evaluated = await evaluateExecutionPackageAction(built.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.validation.valid).toBe(true);
      expect(evaluated.data.readiness.state).toBe("ready");
    }
  });

  it("evaluates an incomplete package (no allocation/schedule) as invalid and waiting_resources", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const evaluated = await evaluateExecutionPackageAction(built.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.validation.valid).toBe(false);
      expect(evaluated.data.readiness.state).toBe("waiting_resources");
    }
  });

  it("validateExecutionPackageAction records a package_validated Timeline event", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    await validateExecutionPackageAction(built.data.id);
    const activities = readActivities();
    expect(activities.some((a) => a.type === "package_validated")).toBe(true);
  });
});

describe("approveExecutionPackageAction / archiveExecutionPackageAction", () => {
  it("blocks approval when the package has blocking validation issues", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const approved = await approveExecutionPackageAction(built.data.id);
    expect(approved.success).toBe(false);
  });

  it("approves a valid package and records package_approved", async () => {
    const plan = await seedPlan();
    const allocation = await seedAllocation();
    const appointment = await seedAppointment();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id, allocationId: allocation.id, appointmentId: appointment.id }));
    if (!built.success) return;

    const approved = await approveExecutionPackageAction(built.data.id);
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.status).toBe("approved");
      expect(approved.data.approved_by).toBe("member_1");
    }
    const activities = readActivities();
    expect(activities.some((a) => a.type === "package_approved")).toBe(true);
  });

  it("archives a package and records package_archived", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const archived = await archiveExecutionPackageAction(built.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");
    const activities = readActivities();
    expect(activities.some((a) => a.type === "package_archived")).toBe(true);
  });
});

describe("compareExecutionPackageVersionsAction", () => {
  it("compares two versions of the same package", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const allocation = await seedAllocation();
    const versioned = await createExecutionPackageVersionAction(built.data.id, baseBuildInput({ operationalPlanId: plan.id, allocationId: allocation.id }));
    if (!versioned.success) return;

    const comparison = await compareExecutionPackageVersionsAction(built.data.id, 1, 2);
    expect(comparison.success).toBe(true);
    if (comparison.success) {
      expect(comparison.data.versionANumber).toBe(1);
      expect(comparison.data.versionBNumber).toBe(2);
      expect(comparison.data.changes.some((c) => c.includes("Allocation changed"))).toBe(true);
    }
  });

  it("errors when a version number doesn't exist", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const comparison = await compareExecutionPackageVersionsAction(built.data.id, 1, 99);
    expect(comparison.success).toBe(false);
  });
});

describe("evaluateExecutionPackagePlatformHealthAction / executionPackageRecommendationsForExecutiveDecisions", () => {
  it("returns packages, findings, and per-package health/readiness maps", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const result = await evaluateExecutionPackagePlatformHealthAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.packages).toHaveLength(1);
      expect(result.data.findings.some((f) => f.type === "planning_risk")).toBe(true);
      expect(result.data.healthByPackageId[built.data.id]).toBeDefined();
      expect(result.data.readinessByPackageId[built.data.id]).toBeDefined();
    }
  });

  it("translates findings into recommendations for Executive Decisions", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) return;

    const recommendations = await executionPackageRecommendationsForExecutiveDecisions();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((r) => r.ruleId.startsWith("execution_package."))).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating action for a session lacking execution_packages.manage", async () => {
    const plan = await seedPlan();
    const built = await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }));
    if (!built.success) throw new Error("failed to build package");

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["execution_packages.view", "operational_planning.view", "operational_planning.manage"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await buildExecutionPackageAction(baseBuildInput({ operationalPlanId: plan.id }))).success).toBe(false);
    expect((await createExecutionPackageVersionAction(built.data.id, baseBuildInput({ operationalPlanId: plan.id }))).success).toBe(false);
    expect((await validateExecutionPackageAction(built.data.id)).success).toBe(false);
    expect((await approveExecutionPackageAction(built.data.id)).success).toBe(false);
    expect((await archiveExecutionPackageAction(built.data.id)).success).toBe(false);
  });
});

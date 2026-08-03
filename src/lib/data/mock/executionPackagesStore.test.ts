import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockExecutionPackagesRepository, resetExecutionPackagesStore, type CreateExecutionPackageInput, type CreateVersionInput } from "@/lib/data/mock/executionPackagesStore";

function baseSnapshot(): CreateVersionInput["snapshot"] {
  return {
    id: "snapshot_1",
    captured_at: "2026-01-01T00:00:00.000Z",
    allocation_id: null,
    allocation_strategy: null,
    allocation_candidates: [],
    appointment_id: null,
    scheduled_starts_at: null,
    scheduled_ends_at: null,
    calendar_id: null,
    operational_plan_id: null,
    phases: [],
    milestones: [],
    deliverables: [],
    evidence_requirements: [],
    checklists: [],
    approvals: [],
    bundle_id: null,
    bundle_snapshot: null,
    dependency_checks: [],
    resource_pool: null,
  };
}

function baseVersionInput(overrides: Partial<CreateVersionInput> = {}): CreateVersionInput {
  return { snapshot: baseSnapshot(), instructions: { sections: [], safety_notes: [], customer_notes: [], equipment_notes: [], vehicle_notes: [], special_instructions: [] }, attachments: [], notes: null, reason: null, ...overrides };
}

function baseInput(overrides: Partial<CreateExecutionPackageInput> = {}): CreateExecutionPackageInput {
  return {
    metadata: { title: "Amoré Wedding — Execution Package", notes: null, tags: [] },
    context: { context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, customer: null, location_placeholder: null, priority: "medium" },
    source: "manual",
    initialVersion: baseVersionInput(),
    ...overrides,
  };
}

beforeEach(() => resetExecutionPackagesStore());
afterEach(() => resetExecutionPackagesStore());

describe("mockExecutionPackagesRepository", () => {
  it("creates a package as draft with one version, current_version_id pointing at it", async () => {
    const result = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.versions).toHaveLength(1);
      expect(result.data.versions[0].version_number).toBe(1);
      expect(result.data.current_version_id).toBe(result.data.versions[0].id);
    }
  });

  it("rejects a blank title", async () => {
    const result = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput({ metadata: { title: "  ", notes: null, tags: [] } }));
    expect(result.success).toBe(false);
  });

  it("listPackagesForWorkspace scopes to the workspace and excludes archived by default", async () => {
    const created = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput());
    await mockExecutionPackagesRepository.createPackage("ws_2", "member_1", baseInput());
    if (!created.success) return;
    await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "archived", null);

    const activeOnly = await mockExecutionPackagesRepository.listPackagesForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withArchived = await mockExecutionPackagesRepository.listPackagesForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
    const ws2 = await mockExecutionPackagesRepository.listPackagesForWorkspace("ws_2");
    expect(ws2).toHaveLength(1);
  });

  it("addVersion appends an immutable version, never mutating the previous one, and resets status to draft", async () => {
    const created = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput());
    if (!created.success) return;
    await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "approved", "member_2");

    const versioned = await mockExecutionPackagesRepository.addVersion(created.data.id, "ws_1", "member_1", baseVersionInput({ reason: "Allocation re-proposed" }));
    expect(versioned.success).toBe(true);
    if (versioned.success) {
      expect(versioned.data.versions).toHaveLength(2);
      expect(versioned.data.versions[0]).toEqual(created.data.versions[0]);
      expect(versioned.data.versions[1].version_number).toBe(2);
      expect(versioned.data.versions[1].reason).toBe("Allocation re-proposed");
      expect(versioned.data.current_version_id).toBe(versioned.data.versions[1].id);
      expect(versioned.data.status).toBe("draft");
      expect(versioned.data.approved_at).toBeNull();
    }
  });

  it("addVersion rejects an archived package", async () => {
    const created = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput());
    if (!created.success) return;
    await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "archived", null);

    const result = await mockExecutionPackagesRepository.addVersion(created.data.id, "ws_1", "member_1", baseVersionInput());
    expect(result.success).toBe(false);
  });

  it("setPackageStatus records approved_at/approved_by on approval, and clears archived_at on reactivation", async () => {
    const created = await mockExecutionPackagesRepository.createPackage("ws_1", "member_1", baseInput());
    if (!created.success) return;

    const approved = await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "approved", "member_2");
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.approved_by).toBe("member_2");
      expect(approved.data.approved_at).not.toBeNull();
    }

    const archived = await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "archived", null);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const reactivated = await mockExecutionPackagesRepository.setPackageStatus(created.data.id, "ws_1", "validated", null);
    expect(reactivated.success).toBe(true);
    if (reactivated.success) {
      expect(reactivated.data.archived_at).toBeNull();
      expect(reactivated.data.approved_by).toBe("member_2");
    }
  });

  it("getPackageById returns null for a package that doesn't exist", async () => {
    expect(await mockExecutionPackagesRepository.getPackageById("execution_package_missing")).toBeNull();
  });
});

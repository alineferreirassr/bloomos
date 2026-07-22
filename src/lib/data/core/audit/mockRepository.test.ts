import { describe, expect, it, beforeEach } from "vitest";
import { mockAuditLogRepository, resetAuditLogStore } from "@/lib/data/core/audit/mockRepository";

const WORKSPACE_A = "ws_a";

beforeEach(() => {
  resetAuditLogStore();
});

describe("mockAuditLogRepository", () => {
  it("records an audit event with before/after and lists it back for its owner", async () => {
    await mockAuditLogRepository.recordAuditEvent(WORKSPACE_A, {
      actor: "Aline",
      action: "status_changed",
      ownerType: "lead",
      ownerId: "lead_1",
      before: { status: "new" },
      after: { status: "contacted" },
    });

    const entries = await mockAuditLogRepository.getAuditLogForOwner(WORKSPACE_A, "lead", "lead_1");
    expect(entries).toHaveLength(1);
    expect(entries[0].before).toEqual({ status: "new" });
    expect(entries[0].after).toEqual({ status: "contacted" });
  });

  it("defaults before/after to null when omitted (e.g. a create action)", async () => {
    await mockAuditLogRepository.recordAuditEvent(WORKSPACE_A, {
      actor: "Aline",
      action: "lead_created",
      ownerType: "lead",
      ownerId: "lead_1",
    });

    const entries = await mockAuditLogRepository.getAuditLogForOwner(WORKSPACE_A, "lead", "lead_1");
    expect(entries[0].before).toBeNull();
    expect(entries[0].after).toBeNull();
  });

  it("getAuditLogForWorkspace returns every entry across owners", async () => {
    await mockAuditLogRepository.recordAuditEvent(WORKSPACE_A, { actor: "Aline", action: "a", ownerType: "lead", ownerId: "lead_1" });
    await mockAuditLogRepository.recordAuditEvent(WORKSPACE_A, { actor: "Aline", action: "b", ownerType: "client", ownerId: "client_1" });

    const all = await mockAuditLogRepository.getAuditLogForWorkspace(WORKSPACE_A);
    expect(new Set(all.map((e) => e.action))).toEqual(new Set(["a", "b"]));
  });

  it("isolates entries by workspace_id", async () => {
    await mockAuditLogRepository.recordAuditEvent(WORKSPACE_A, { actor: "Aline", action: "a", ownerType: "lead", ownerId: "lead_1" });
    const forOtherWorkspace = await mockAuditLogRepository.getAuditLogForWorkspace("ws_b");
    expect(forOtherWorkspace).toEqual([]);
  });

  it("has no update or delete method on the repository interface (immutability enforced at the type level)", () => {
    const repo = mockAuditLogRepository as unknown as Record<string, unknown>;
    expect(repo.updateAuditEvent).toBeUndefined();
    expect(repo.deleteAuditEvent).toBeUndefined();
  });
});

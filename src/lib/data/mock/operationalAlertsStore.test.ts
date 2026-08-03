import { beforeEach, describe, expect, it } from "vitest";
import { resetOperationalAlertsStore, mockOperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";
import type { OperationalSignal } from "@/types/operationsCenter";

function makeSignal(overrides: Partial<OperationalSignal> = {}): OperationalSignal {
  return { ruleId: "dispatch.blocked", category: "dispatch", severity: "high", title: "Dispatch Blocked", description: "This dispatch order is blocked.", sourceRef: { nodeType: "event", nodeId: "event_1" }, sourceRecordId: "dispatch_order_1", occurredAt: "2026-01-01T00:00:00.000Z", ...overrides };
}

beforeEach(() => {
  resetOperationalAlertsStore();
});

describe("operationalAlertsStore", () => {
  it("creates a fresh open alert from a signal", async () => {
    const result = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("open");
    expect(result.data.rule_id).toBe("dispatch.blocked");
  });

  it("reconciles a repeated signal with the same dedupe key against the existing open alert, never duplicating", async () => {
    const first = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    const second = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!first.success || !second.success) throw new Error("failed to upsert");
    expect(second.data.id).toBe(first.data.id);
    const list = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(list).toHaveLength(1);
  });

  it("creates a new alert for a signal with a different source record, even with the same rule", async () => {
    await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal({ sourceRecordId: "dispatch_order_2" }));
    const list = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(list).toHaveLength(2);
  });

  it("creates a new alert for a signal with a different source ref when no source record id is given either", async () => {
    await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal({ sourceRecordId: null }));
    await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal({ sourceRecordId: null, sourceRef: { nodeType: "event", nodeId: "event_2" } }));
    const list = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(list).toHaveLength(2);
  });

  it("lists only open/acknowledged/escalated alerts by default, excluding resolved/dismissed", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    await mockOperationalAlertsRepository.resolveAlert(created.data.id, "ws_1", "member_1", "Fixed manually.");

    const activeOnly = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withResolved = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1", true);
    expect(withResolved).toHaveLength(1);
  });

  it("acknowledges an alert, recording who and when", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const result = await mockOperationalAlertsRepository.acknowledgeAlert(created.data.id, "ws_1", "member_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("acknowledged");
      expect(result.data.acknowledged_by).toBe("member_1");
      expect(result.data.acknowledged_at).not.toBeNull();
    }
  });

  it("resolves an alert with an explicit reason", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const result = await mockOperationalAlertsRepository.resolveAlert(created.data.id, "ws_1", "member_1", "Confirmed fixed on site.");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("resolved");
      expect(result.data.resolution_reason).toBe("Confirmed fixed on site.");
    }
  });

  it("dismisses an alert with a reason", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const result = await mockOperationalAlertsRepository.dismissAlert(created.data.id, "ws_1", "member_1", "Not relevant.");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("dismissed");
  });

  it("escalates an alert", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const result = await mockOperationalAlertsRepository.escalateAlert(created.data.id, "ws_1", "member_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("escalated");
  });

  it("auto-resolves an open alert whose dedupe key is absent from the latest live signal set", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const resolved = await mockOperationalAlertsRepository.autoResolveGoneAlerts("ws_1", new Set());
    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe("resolved");
    expect(resolved[0].resolution_reason).toContain("no longer present");
  });

  it("does not auto-resolve an alert still present in the live signal set", async () => {
    const created = await mockOperationalAlertsRepository.upsertAlertFromSignal("ws_1", makeSignal());
    if (!created.success) throw new Error("failed to create");
    const resolved = await mockOperationalAlertsRepository.autoResolveGoneAlerts("ws_1", new Set([created.data.dedupe_key]));
    expect(resolved).toHaveLength(0);
  });

  it("errors when acting on an alert that doesn't exist", async () => {
    const result = await mockOperationalAlertsRepository.acknowledgeAlert("operational_alert_missing", "ws_1", "member_1");
    expect(result.success).toBe(false);
  });
});

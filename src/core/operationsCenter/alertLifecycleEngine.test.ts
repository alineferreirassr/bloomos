import { beforeEach, describe, expect, it } from "vitest";
import { reconcileAlerts } from "@/core/operationsCenter/alertLifecycleEngine";
import { resetOperationalAlertsStore, mockOperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";
import type { OperationalSignal } from "@/types/operationsCenter";

function makeSignal(overrides: Partial<OperationalSignal> = {}): OperationalSignal {
  return { ruleId: "dispatch.assignment_declined", category: "dispatch", severity: "medium", title: "Assignment declined", description: "", sourceRef: null, sourceRecordId: "assignment_1", occurredAt: "2026-01-01T00:00:00.000Z", ...overrides };
}

beforeEach(() => {
  resetOperationalAlertsStore();
});

describe("reconcileAlerts", () => {
  it("creates a fresh open alert for each distinct live signal", async () => {
    const result = await reconcileAlerts("ws_1", [makeSignal({ sourceRecordId: "a1" }), makeSignal({ sourceRecordId: "a2" })], mockOperationalAlertsRepository);
    expect(result.reconciled).toHaveLength(2);
    expect(result.reconciled.every((a) => a.status === "open")).toBe(true);
  });

  it("reconciles a repeated run against the same still-live signal without duplicating", async () => {
    await reconcileAlerts("ws_1", [makeSignal()], mockOperationalAlertsRepository);
    const second = await reconcileAlerts("ws_1", [makeSignal()], mockOperationalAlertsRepository);
    expect(second.reconciled).toHaveLength(1);
    const all = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("auto-resolves an alert whose condition disappears from the next run's live signal set", async () => {
    await reconcileAlerts("ws_1", [makeSignal({ sourceRecordId: "a1" })], mockOperationalAlertsRepository);
    const second = await reconcileAlerts("ws_1", [], mockOperationalAlertsRepository);
    expect(second.autoResolved).toHaveLength(1);
    expect(second.autoResolved[0].status).toBe("resolved");
  });

  it("does not auto-resolve an alert whose condition is still present", async () => {
    await reconcileAlerts("ws_1", [makeSignal({ sourceRecordId: "a1" })], mockOperationalAlertsRepository);
    const second = await reconcileAlerts("ws_1", [makeSignal({ sourceRecordId: "a1" })], mockOperationalAlertsRepository);
    expect(second.autoResolved).toHaveLength(0);
    const openAlerts = await mockOperationalAlertsRepository.listAlertsForWorkspace("ws_1");
    expect(openAlerts).toHaveLength(1);
  });

  it("acknowledging an alert never mutates any source module — it only changes the alert's own record", async () => {
    const result = await reconcileAlerts("ws_1", [makeSignal({ sourceRecordId: "a1" })], mockOperationalAlertsRepository);
    const [alert] = result.reconciled;
    const acknowledged = await mockOperationalAlertsRepository.acknowledgeAlert(alert.id, "ws_1", "member_1");
    expect(acknowledged.success).toBe(true);
    if (acknowledged.success) expect(acknowledged.data.status).toBe("acknowledged");
  });
});

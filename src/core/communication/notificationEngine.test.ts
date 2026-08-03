import { describe, expect, it } from "vitest";
import { buildNotificationInput, isNotificationKind, NOTIFICATION_KIND_META } from "@/core/communication/notificationEngine";
import { NOTIFICATION_KINDS } from "@/core/notifications/types";

describe("NOTIFICATION_KIND_META", () => {
  it("has metadata for every declared kind, with no gaps", () => {
    for (const kind of NOTIFICATION_KINDS) {
      expect(NOTIFICATION_KIND_META[kind]).toBeDefined();
      expect(NOTIFICATION_KIND_META[kind].label.length).toBeGreaterThan(0);
    }
  });
});

describe("isNotificationKind", () => {
  it("recognizes a real kind and rejects an arbitrary string", () => {
    expect(isNotificationKind("invoice_paid")).toBe(true);
    expect(isNotificationKind("not_a_real_kind")).toBe(false);
  });
});

describe("buildNotificationInput", () => {
  it("applies the kind's own default priority when no override is given", () => {
    const input = buildNotificationInput({ kind: "payment_failed", recipientMemberId: "member_1", title: "Payment failed", body: "Card declined." });
    expect(input.priority).toBe("critical");
    expect(input.kind).toBe("payment_failed");
  });

  it("lets an explicit priorityOverride win over the kind's default", () => {
    const input = buildNotificationInput({ kind: "workflow_finished", recipientMemberId: "member_1", title: "Workflow done", body: "", priorityOverride: "critical" });
    expect(input.priority).toBe("critical");
  });

  it("defaults relatedOwnerType/relatedOwnerId to null rather than undefined", () => {
    const input = buildNotificationInput({ kind: "lead_created", recipientMemberId: "member_1", title: "New lead", body: "" });
    expect(input.relatedOwnerType).toBeNull();
    expect(input.relatedOwnerId).toBeNull();
  });
});

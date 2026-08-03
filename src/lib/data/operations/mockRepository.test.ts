import { describe, expect, it, beforeEach } from "vitest";
import { mockLiveEventLogRepository, resetLiveEventLogStore } from "@/lib/data/operations/mockRepository";

describe("mockLiveEventLogRepository", () => {
  beforeEach(() => {
    resetLiveEventLogStore();
  });

  it("logs an entry and reads it back scoped to its event", async () => {
    const result = await mockLiveEventLogRepository.logEntry("ws_1", {
      event_id: "event_1",
      kind: "check_in",
      note: "Arrived on site",
      logged_by_name: "Jordan Ellis",
    });
    expect(result.success).toBe(true);

    const log = await mockLiveEventLogRepository.getLogByEventId("event_1");
    expect(log).toHaveLength(1);
    expect(log[0].kind).toBe("check_in");
    expect(log[0].logged_by_name).toBe("Jordan Ellis");
  });

  it("rejects a blank logged_by_name", async () => {
    const result = await mockLiveEventLogRepository.logEntry("ws_1", {
      event_id: "event_1",
      kind: "issue_reported",
      note: "Generator not working",
      logged_by_name: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("scopes entries by event_id — a different event's log stays empty", async () => {
    await mockLiveEventLogRepository.logEntry("ws_1", { event_id: "event_1", kind: "check_in", note: null, logged_by_name: "Jordan" });
    const otherEventLog = await mockLiveEventLogRepository.getLogByEventId("event_2");
    expect(otherEventLog).toHaveLength(0);
  });

  it("returns entries newest first", async () => {
    await mockLiveEventLogRepository.logEntry("ws_1", { event_id: "event_1", kind: "check_in", note: "first", logged_by_name: "Jordan" });
    await mockLiveEventLogRepository.logEntry("ws_1", { event_id: "event_1", kind: "help_requested", note: "second", logged_by_name: "Jordan" });
    const log = await mockLiveEventLogRepository.getLogByEventId("event_1");
    expect(log[0].note).toBe("second");
  });
});

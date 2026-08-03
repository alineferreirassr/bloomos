import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockCalendarsRepository, resetCalendarsStore, type CreateCalendarInput } from "@/lib/data/mock/calendarsStore";

const baseInput: CreateCalendarInput = {
  name: "Main Calendar",
  description: null,
  context_type: "workspace",
  context: null,
  time_zone: "UTC",
};

beforeEach(() => resetCalendarsStore());
afterEach(() => resetCalendarsStore());

describe("mockCalendarsRepository", () => {
  it("creates a calendar as active", async () => {
    const result = await mockCalendarsRepository.createCalendar("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.archived_at).toBeNull();
    }
  });

  it("rejects a blank name", async () => {
    const result = await mockCalendarsRepository.createCalendar("ws_1", "member_1", { ...baseInput, name: "  " });
    expect(result.success).toBe(false);
  });

  it("lists calendars scoped to the workspace, excluding archived by default", async () => {
    const created = await mockCalendarsRepository.createCalendar("ws_1", "member_1", baseInput);
    await mockCalendarsRepository.createCalendar("ws_2", "member_1", baseInput);
    if (created.success) await mockCalendarsRepository.setCalendarStatus(created.data.id, "ws_1", "archived");

    expect(await mockCalendarsRepository.listCalendarsForWorkspace("ws_1")).toEqual([]);
    expect(await mockCalendarsRepository.listCalendarsForWorkspace("ws_1", true)).toHaveLength(1);
  });

  it("getCalendarById returns null for an unknown id", async () => {
    expect(await mockCalendarsRepository.getCalendarById("missing")).toBeNull();
  });

  it("setCalendarStatus sets archived_at when archiving and clears it when reactivating", async () => {
    const created = await mockCalendarsRepository.createCalendar("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");

    const archived = await mockCalendarsRepository.setCalendarStatus(created.data.id, "ws_1", "archived");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const reactivated = await mockCalendarsRepository.setCalendarStatus(created.data.id, "ws_1", "active");
    expect(reactivated.success).toBe(true);
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();
  });

  it("setCalendarStatus fails for a calendar in a different workspace", async () => {
    const created = await mockCalendarsRepository.createCalendar("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const result = await mockCalendarsRepository.setCalendarStatus(created.data.id, "ws_2", "archived");
    expect(result.success).toBe(false);
  });
});

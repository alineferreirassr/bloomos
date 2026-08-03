import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockCalendarWindowsRepository, resetCalendarWindowsStore, type CreateCalendarWindowInput } from "@/lib/data/mock/calendarWindowsStore";

const baseInput: CreateCalendarWindowInput = {
  calendar_id: "calendar_1",
  type: "blocked",
  starts_at: "2026-08-03T10:00:00.000Z",
  ends_at: "2026-08-03T11:00:00.000Z",
  reason: "Maintenance",
};

beforeEach(() => resetCalendarWindowsStore());
afterEach(() => resetCalendarWindowsStore());

describe("mockCalendarWindowsRepository", () => {
  it("creates a window", async () => {
    const result = await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects ends_at not after starts_at", async () => {
    const result = await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", { ...baseInput, ends_at: baseInput.starts_at });
    expect(result.success).toBe(false);
  });

  it("listWindowsForWorkspace scopes to the workspace", async () => {
    await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", baseInput);
    await mockCalendarWindowsRepository.createWindow("ws_2", "member_1", baseInput);
    expect(await mockCalendarWindowsRepository.listWindowsForWorkspace("ws_1")).toHaveLength(1);
  });

  it("listWindowsForCalendar includes both calendar-specific and workspace-wide (null calendar_id) windows", async () => {
    await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", baseInput);
    await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", { ...baseInput, calendar_id: null });
    await mockCalendarWindowsRepository.createWindow("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });

    const result = await mockCalendarWindowsRepository.listWindowsForCalendar("ws_1", "calendar_1");
    expect(result).toHaveLength(2);
  });
});

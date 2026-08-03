import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockHolidaysRepository, resetHolidaysStore, type CreateHolidayInput } from "@/lib/data/mock/holidaysStore";

const baseInput: CreateHolidayInput = {
  name: "Founders Day",
  scope: "workspace",
  date: "2026-08-03",
  recurring: false,
  emergency: false,
  time_zone: "UTC",
};

beforeEach(() => resetHolidaysStore());
afterEach(() => resetHolidaysStore());

describe("mockHolidaysRepository", () => {
  it("creates a holiday", async () => {
    const result = await mockHolidaysRepository.createHoliday("ws_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects a blank name", async () => {
    const result = await mockHolidaysRepository.createHoliday("ws_1", { ...baseInput, name: " " });
    expect(result.success).toBe(false);
  });

  it("listHolidaysForWorkspace scopes to the workspace", async () => {
    await mockHolidaysRepository.createHoliday("ws_1", baseInput);
    await mockHolidaysRepository.createHoliday("ws_2", baseInput);
    expect(await mockHolidaysRepository.listHolidaysForWorkspace("ws_1")).toHaveLength(1);
  });
});

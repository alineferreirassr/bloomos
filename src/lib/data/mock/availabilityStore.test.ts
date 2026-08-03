import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockAvailabilityRepository, resetAvailabilityStore, type CreateAvailabilityWindowInput } from "@/lib/data/mock/availabilityStore";

const baseInput: CreateAvailabilityWindowInput = { worker_id: "worker_1", status: "available", starts_at: "2026-07-30T08:00:00.000Z", ends_at: null, note: null, time_zone: "America/Sao_Paulo" };

beforeEach(() => resetAvailabilityStore());
afterEach(() => resetAvailabilityStore());

describe("mockAvailabilityRepository", () => {
  it("records an open-ended window", async () => {
    const result = await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ends_at).toBeNull();
  });

  it("rejects a window whose end is before its start", async () => {
    const result = await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", { ...baseInput, ends_at: "2026-07-30T07:00:00.000Z" });
    expect(result.success).toBe(false);
  });

  it("closes the worker's prior open window when a new one is recorded", async () => {
    const first = await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", baseInput);
    if (!first.success) return;
    await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", { ...baseInput, status: "on_break", starts_at: "2026-07-30T12:00:00.000Z" });

    const windows = await mockAvailabilityRepository.listWindowsForWorker("worker_1");
    const closedFirst = windows.find((w) => w.id === first.data.id);
    expect(closedFirst?.ends_at).toBe("2026-07-30T12:00:00.000Z");
  });

  it("getCurrentWindow returns the open window when one exists", async () => {
    await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", baseInput);
    const current = await mockAvailabilityRepository.getCurrentWindow("worker_1");
    expect(current?.status).toBe("available");
  });

  it("getCurrentWindow falls back to the most recent closed window", async () => {
    await mockAvailabilityRepository.recordAvailabilityWindow("ws_1", { ...baseInput, ends_at: "2026-07-30T09:00:00.000Z" });
    const current = await mockAvailabilityRepository.getCurrentWindow("worker_1");
    expect(current).not.toBeNull();
  });

  it("returns null when the worker has no windows", async () => {
    expect(await mockAvailabilityRepository.getCurrentWindow("worker_ghost")).toBeNull();
  });
});

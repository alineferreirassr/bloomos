import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockLocationRepository, resetLocationStore, type RecordLocationInput } from "@/lib/data/mock/locationStore";

const baseInput: RecordLocationInput = { worker_id: "worker_1", latitude: -23.55, longitude: -46.63, accuracy_meters: 10, source: "mobile_app" };

beforeEach(() => resetLocationStore());
afterEach(() => resetLocationStore());

describe("mockLocationRepository", () => {
  it("records a snapshot and returns it as the latest", async () => {
    await mockLocationRepository.recordSnapshot("ws_1", baseInput);
    const latest = await mockLocationRepository.getLatestSnapshot("worker_1");
    expect(latest?.latitude).toBe(-23.55);
  });

  it("overwrites the previous snapshot for the same worker — no history is kept", async () => {
    await mockLocationRepository.recordSnapshot("ws_1", baseInput);
    await mockLocationRepository.recordSnapshot("ws_1", { ...baseInput, latitude: 10, longitude: 20 });

    const latest = await mockLocationRepository.getLatestSnapshot("worker_1");
    expect(latest?.latitude).toBe(10);

    const all = await mockLocationRepository.listLatestSnapshotsForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("returns null for a worker with no snapshot", async () => {
    expect(await mockLocationRepository.getLatestSnapshot("worker_ghost")).toBeNull();
  });

  it("scopes listLatestSnapshotsForWorkspace by workspace", async () => {
    await mockLocationRepository.recordSnapshot("ws_1", baseInput);
    await mockLocationRepository.recordSnapshot("ws_2", { ...baseInput, worker_id: "worker_2" });
    expect(await mockLocationRepository.listLatestSnapshotsForWorkspace("ws_1")).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockMobileSessionsRepository, resetMobileSessionsStore, type StartMobileSessionInput } from "@/lib/data/mock/mobileSessionsStore";

const baseInput: StartMobileSessionInput = { worker_id: "worker_1", device_label: "iPhone 17 Pro", platform: "ios" };

beforeEach(() => resetMobileSessionsStore());
afterEach(() => resetMobileSessionsStore());

describe("mockMobileSessionsRepository", () => {
  it("starts a session with matching started_at/last_seen_at and no ended_at", async () => {
    const result = await mockMobileSessionsRepository.startSession("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.started_at).toBe(result.data.last_seen_at);
      expect(result.data.ended_at).toBeNull();
    }
  });

  it("touchSession updates last_seen_at", async () => {
    const started = await mockMobileSessionsRepository.startSession("ws_1", baseInput);
    if (!started.success) return;
    const touched = await mockMobileSessionsRepository.touchSession(started.data.id, "ws_1");
    expect(touched.success).toBe(true);
  });

  it("endSession sets ended_at and the given status", async () => {
    const started = await mockMobileSessionsRepository.startSession("ws_1", baseInput);
    if (!started.success) return;
    const ended = await mockMobileSessionsRepository.endSession(started.data.id, "ws_1", "revoked");
    expect(ended.success).toBe(true);
    if (ended.success) {
      expect(ended.data.status).toBe("revoked");
      expect(ended.data.ended_at).not.toBeNull();
    }
  });

  it("fails to touch a session in a different workspace", async () => {
    const started = await mockMobileSessionsRepository.startSession("ws_1", baseInput);
    if (!started.success) return;
    const result = await mockMobileSessionsRepository.touchSession(started.data.id, "ws_2");
    expect(result.success).toBe(false);
  });
});

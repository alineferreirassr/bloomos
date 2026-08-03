import { describe, expect, it } from "vitest";
import { deriveSessionStatus, countActiveSessions } from "@/core/workforce/mobileSessionEngine";
import type { MobileSession } from "@/types/workforce";

const NOW = "2026-07-30T12:00:00.000Z";

function makeSession(overrides: Partial<MobileSession> = {}): MobileSession {
  return {
    id: "session_1",
    workspace_id: "ws_1",
    worker_id: "worker_1",
    device_label: "iPhone 17 Pro",
    platform: "ios",
    status: "active",
    started_at: "2026-07-30T00:00:00.000Z",
    last_seen_at: "2026-07-30T11:00:00.000Z",
    ended_at: null,
    ...overrides,
  };
}

describe("deriveSessionStatus", () => {
  it("stays active within the TTL window", () => {
    expect(deriveSessionStatus(makeSession({ last_seen_at: "2026-07-30T11:00:00.000Z" }), NOW)).toBe("active");
  });

  it("computes 'expired' once last_seen_at is older than the TTL, without ever mutating the stored status", () => {
    const session = makeSession({ last_seen_at: "2026-07-29T00:00:00.000Z" });
    expect(deriveSessionStatus(session, NOW)).toBe("expired");
    expect(session.status).toBe("active");
  });

  it("never overrides an already-terminal stored status", () => {
    expect(deriveSessionStatus(makeSession({ status: "revoked", last_seen_at: "2026-07-30T11:59:00.000Z" }), NOW)).toBe("revoked");
  });

  it("respects a custom TTL", () => {
    const session = makeSession({ last_seen_at: "2026-07-30T11:00:00.000Z" });
    expect(deriveSessionStatus(session, NOW, 0.5)).toBe("expired");
  });
});

describe("countActiveSessions", () => {
  it("counts only sessions whose derived status is active", () => {
    const sessions = [makeSession({ id: "s1", last_seen_at: "2026-07-30T11:00:00.000Z" }), makeSession({ id: "s2", last_seen_at: "2026-07-01T00:00:00.000Z" }), makeSession({ id: "s3", status: "revoked" })];
    expect(countActiveSessions(sessions, NOW)).toBe(1);
  });
});

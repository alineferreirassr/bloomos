import type { MobileSession, MobileSessionStatus } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 7 — Mobile Session Engine. Session lifecycle
 * only, no push infra, no device management, no offline sync (that's
 * `offlineEngine.ts`'s narrower job). A session's stored `status` is
 * never mutated to `"expired"` by a background job — this checkpoint has
 * no scheduler — `deriveSessionStatus` computes it fresh from
 * `last_seen_at` + a TTL, the same "definition vs. computed" split
 * `objectiveEngine.deriveEffectiveStatus` established.
 */

export const DEFAULT_SESSION_TTL_HOURS = 12;

export function deriveSessionStatus(session: Pick<MobileSession, "status" | "last_seen_at">, now: string, ttlHours = DEFAULT_SESSION_TTL_HOURS): MobileSessionStatus {
  if (session.status !== "active") return session.status;

  const staleMs = new Date(now).getTime() - new Date(session.last_seen_at).getTime();
  const ttlMs = ttlHours * 60 * 60 * 1000;
  return staleMs > ttlMs ? "expired" : "active";
}

export function countActiveSessions(sessions: MobileSession[], now: string, ttlHours = DEFAULT_SESSION_TTL_HOURS): number {
  return sessions.filter((s) => deriveSessionStatus(s, now, ttlHours) === "active").length;
}

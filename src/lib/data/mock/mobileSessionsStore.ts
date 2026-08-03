import type { MobileSession, MobilePlatform } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 26, Step 7 — Mobile Session registry persistence. Session lifecycle only — no push infra, no device management. */
let sessions: MobileSession[] = [];

export function resetMobileSessionsStore(): void {
  sessions = [];
}

export interface StartMobileSessionInput {
  worker_id: string;
  device_label: string;
  platform: MobilePlatform;
}

async function listSessionsForWorker(workerId: string): Promise<MobileSession[]> {
  return sessions.filter((s) => s.worker_id === workerId);
}

async function listSessionsForWorkspace(workspaceId: string): Promise<MobileSession[]> {
  return sessions.filter((s) => s.workspace_id === workspaceId);
}

async function startSession(workspaceId: string, input: StartMobileSessionInput): Promise<DataResult<MobileSession>> {
  const timestamp = nowIso();
  const session: MobileSession = {
    id: generateId("mobile_session"),
    workspace_id: workspaceId,
    worker_id: input.worker_id,
    device_label: input.device_label,
    platform: input.platform,
    status: "active",
    started_at: timestamp,
    last_seen_at: timestamp,
    ended_at: null,
  };
  sessions = [...sessions, session];
  return ok(session);
}

async function touchSession(id: string, workspaceId: string): Promise<DataResult<MobileSession>> {
  const existing = sessions.find((s) => s.id === id && s.workspace_id === workspaceId);
  if (!existing) return fail("This mobile session could not be found.");

  const updated: MobileSession = { ...existing, last_seen_at: nowIso() };
  sessions = sessions.map((s) => (s.id === id ? updated : s));
  return ok(updated);
}

async function endSession(id: string, workspaceId: string, status: "expired" | "revoked" = "revoked"): Promise<DataResult<MobileSession>> {
  const existing = sessions.find((s) => s.id === id && s.workspace_id === workspaceId);
  if (!existing) return fail("This mobile session could not be found.");

  const updated: MobileSession = { ...existing, status, ended_at: nowIso() };
  sessions = sessions.map((s) => (s.id === id ? updated : s));
  return ok(updated);
}

export interface MobileSessionsRepository {
  listSessionsForWorker: typeof listSessionsForWorker;
  listSessionsForWorkspace: typeof listSessionsForWorkspace;
  startSession: typeof startSession;
  touchSession: typeof touchSession;
  endSession: typeof endSession;
}

export const mockMobileSessionsRepository: MobileSessionsRepository = {
  listSessionsForWorker,
  listSessionsForWorkspace,
  startSession,
  touchSession,
  endSession,
};

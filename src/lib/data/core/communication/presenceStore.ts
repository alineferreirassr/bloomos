import type { MemberPresence } from "@/types/communication";
import { nowIso, delay } from "@/lib/data/utils";

/** v2.0 Checkpoint 24, Step 11 — Presence System's own persistence. One row per member, upserted on every heartbeat rather than an append-only log — presence is current state, not history. */
let presenceByMember: Record<string, MemberPresence> = {};

/** Test-only: restore the store to empty between test cases. */
export function resetPresenceStore(): void {
  presenceByMember = {};
}

async function heartbeat(workspaceId: string, memberId: string): Promise<MemberPresence> {
  await delay(50);
  const existing = presenceByMember[memberId];
  const updated: MemberPresence = { member_id: memberId, workspace_id: workspaceId, last_active_at: nowIso(), manual_status: existing?.manual_status ?? null };
  presenceByMember = { ...presenceByMember, [memberId]: updated };
  return updated;
}

async function setManualStatus(workspaceId: string, memberId: string, manualStatus: "busy" | "dnd" | null): Promise<MemberPresence> {
  await delay(50);
  const existing = presenceByMember[memberId];
  const updated: MemberPresence = { member_id: memberId, workspace_id: workspaceId, last_active_at: existing?.last_active_at ?? nowIso(), manual_status: manualStatus };
  presenceByMember = { ...presenceByMember, [memberId]: updated };
  return updated;
}

async function getPresence(memberId: string): Promise<MemberPresence | null> {
  await delay(50);
  return presenceByMember[memberId] ?? null;
}

async function listPresenceForWorkspace(workspaceId: string): Promise<MemberPresence[]> {
  await delay(50);
  return Object.values(presenceByMember).filter((p) => p.workspace_id === workspaceId);
}

export const mockPresenceRepository = {
  heartbeat,
  setManualStatus,
  getPresence,
  listPresenceForWorkspace,
};

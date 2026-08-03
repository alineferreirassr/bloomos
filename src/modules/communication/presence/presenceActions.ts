"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockPresenceRepository } from "@/lib/data/core/communication/presenceStore";
import { deriveStatus } from "@/core/communication/presenceEngine";
import { clockNow } from "@/core/time/clock";
import type { PresenceStatus } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "Presence isn't available. You may not have access to it.";

export interface MemberPresenceView {
  memberId: string;
  status: PresenceStatus;
  lastActiveAt: string;
}

/** Called on an interval / visibility-change from the client — see `docs/presence-system.md` for why this is a polled heartbeat, not a websocket push (no realtime transport exists anywhere in BloomOS). */
export async function heartbeatAction(): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  await mockPresenceRepository.heartbeat(session.workspace.id, session.membership.id);
  return { success: true };
}

export async function setManualPresenceStatusAction(manualStatus: "busy" | "dnd" | null): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  await mockPresenceRepository.setManualStatus(session.workspace.id, session.membership.id, manualStatus);
  return { success: true };
}

export async function getWorkspacePresenceAction(): Promise<{ success: true; data: MemberPresenceView[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const rows = await mockPresenceRepository.listPresenceForWorkspace(session.workspace.id);
  const now = clockNow();
  return {
    success: true,
    data: rows.map((row) => ({ memberId: row.member_id, status: deriveStatus(row.last_active_at, row.manual_status, now), lastActiveAt: row.last_active_at })),
  };
}

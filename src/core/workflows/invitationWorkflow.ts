import { INVITATION_STATUSES, type InvitationStatus } from "@/core/enums/invitationStatus";

export { INVITATION_STATUSES };
export type { InvitationStatus };

/**
 * The canonical invitation lifecycle. `pending` is the only status a new
 * invitation ever starts in; every other status is a terminal off-ramp —
 * an already-`accepted`/`expired`/`revoked` invitation never transitions
 * again (resending a `pending` invitation supersedes its token in place,
 * it doesn't change status; see lib/data/team/).
 */
const INVITATION_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  pending: ["accepted", "expired", "revoked"],
  accepted: [],
  expired: [],
  revoked: [],
};

export function canTransitionInvitationStatus(from: InvitationStatus, to: InvitationStatus): boolean {
  if (from === to) return false;
  return INVITATION_TRANSITIONS[from].includes(to);
}

export function isInvitationTerminal(status: InvitationStatus): boolean {
  return status !== "pending";
}

interface InvitationForNextAction {
  status: InvitationStatus;
  expires_at: string;
}

/** Same 14-day "expiring soon" window convention as Documents' getDocumentNextRecommendedAction. */
export const INVITATION_EXPIRING_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function getInvitationNextRecommendedAction(invitation: InvitationForNextAction): string | null {
  if (invitation.status !== "pending") return null;

  const msUntilExpiry = new Date(invitation.expires_at).getTime() - Date.now();
  if (msUntilExpiry <= 0) return "This invitation has expired — resend it";
  if (msUntilExpiry <= INVITATION_EXPIRING_SOON_WINDOW_MS) return "This invitation expires soon — consider resending it";
  return null;
}

import type { ClientAccountStatus } from "@/core/enums/clientAccountStatus";

/**
 * The Client Portal account lifecycle. `invited` is reserved/unused (see
 * core/enums/clientAccountStatus.ts) — a real account only ever starts at
 * `active` (created directly by `accept_client_invitation`). `suspended`
 * and `revoked` are both explicitly reversible back to `active` via a
 * deliberate internal action (`reactivateClientAccount`) or a fresh
 * accepted invitation — "revoked accounts cannot regain access without a
 * new invitation or explicit reactivation" (approved spec), so `revoked`
 * is not a hard dead end the way, say, a Lead's `converted` status is.
 */
const CLIENT_ACCOUNT_TRANSITIONS: Record<ClientAccountStatus, ClientAccountStatus[]> = {
  invited: ["active"],
  active: ["suspended", "revoked"],
  suspended: ["active", "revoked"],
  revoked: ["active"],
};

export function canTransitionClientAccountStatus(from: ClientAccountStatus, to: ClientAccountStatus): boolean {
  if (from === to) return false;
  return CLIENT_ACCOUNT_TRANSITIONS[from].includes(to);
}

/** True only while an account is blocked from portal access — used to decide whether to render a "reactivate" affordance. */
export function isClientAccountBlocked(status: ClientAccountStatus): boolean {
  return status === "suspended" || status === "revoked";
}

/**
 * Generic, reusable shape for a stuck-but-recoverable multi-step operation —
 * first used by the Booking Workflow (Lead conversion succeeds, Event
 * creation fails), but not tied to Booking: `workflow` and `payload` are the
 * only workflow-specific parts. Any future recoverable operation reuses this
 * same shape and the same `client_recovery_pending`/`client_recovery_resolved`
 * Timeline activity types rather than inventing its own column or Timeline
 * vocabulary. Not DB-enforced (stored as jsonb) — this interface is the only
 * source of truth for its shape.
 */
export interface PendingRecovery {
  version: number;
  workflow: string;
  status: "pending";
  reason: string;
  payload: Record<string, unknown>;
  attempts: number;
  first_attempt_at: string;
  last_attempt_at: string;
}

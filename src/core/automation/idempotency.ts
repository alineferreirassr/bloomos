import "server-only";
import { createAutomationServiceRoleClient } from "@/core/automation/automationServiceRole";
import { getLogger } from "@/core/observability/logger";

/**
 * SOCIAL-11B — the durable idempotency ledger's own TS boundary. Nothing
 * calls this module yet (no Meta webhook exists — see the migration's own
 * header comment; this checkpoint wires no producer). It exists so a
 * future webhook-processing context has a ready, already-correct claim/
 * complete pair to call, rather than each future provider integration
 * inventing its own dedup logic the way Stripe's own
 * `findExistingPaymentByReference` did.
 *
 * IDEMPOTENCY SEMANTICS (explicit, per this checkpoint's own authorization):
 * - The "delivery/event" this ledger tracks is one (workspaceId, source,
 *   dedupKey) triple — `source` names the producer (e.g. a future
 *   "meta_webhook"), `dedupKey` is that producer's own unique delivery/
 *   event id.
 * - The key is reserved BEFORE the triggered automation ever runs, not
 *   after it succeeds — `claimAutomationIdempotencyKey` must be called
 *   first, and the caller must only proceed to actually execute if
 *   `claimed: true` comes back.
 * - Two callers racing the same key: the database's own unique constraint
 *   plus `claim_automation_idempotency_key()`'s single atomic
 *   `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statement guarantees
 *   exactly one of them ever gets `claimed: true` — this is enforced in
 *   Postgres, not by a check in this file.
 * - If the first attempt fails, the key becomes reusable: call
 *   `completeAutomationIdempotencyKey(id, "failed")`, and the provider's
 *   own redelivery of the same event will successfully re-claim it. A
 *   `"completed"` key is never reusable.
 * - `executionId` links a completed claim to the `automation_executions`
 *   row it produced, when one exists — optional, since a detected
 *   duplicate (`claimed: false`) never produces a new execution at all.
 */

export interface AutomationIdempotencyKey {
  id: string;
  workspaceId: string;
  source: string;
  dedupKey: string;
  status: "processing" | "completed" | "failed";
  executionId: string | null;
  attemptCount: number;
  claimedAt: string;
  completedAt: string | null;
}

interface AutomationIdempotencyKeyRow {
  id: string;
  workspace_id: string;
  source: string;
  dedup_key: string;
  status: string;
  execution_id: string | null;
  attempt_count: number;
  claimed_at: string;
  completed_at: string | null;
}

function mapRow(row: AutomationIdempotencyKeyRow): AutomationIdempotencyKey {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    source: row.source,
    dedupKey: row.dedup_key,
    status: row.status as AutomationIdempotencyKey["status"],
    executionId: row.execution_id,
    attemptCount: row.attempt_count,
    claimedAt: row.claimed_at,
    completedAt: row.completed_at,
  };
}

const SERVICE_ROLE_UNAVAILABLE_ERROR = "Automation idempotency ledger is not available — service-role credential is not configured.";

export type ClaimAutomationIdempotencyKeyResult = { success: true; claimed: true; key: AutomationIdempotencyKey } | { success: true; claimed: false } | { success: false; error: string };

/**
 * Reserves (workspaceId, source, dedupKey) for processing. `claimed: true`
 * means the caller now owns this attempt and must proceed; `claimed: false`
 * means the key is already processing or completed elsewhere and this
 * delivery must be treated as a safe no-op duplicate.
 */
export async function claimAutomationIdempotencyKey(workspaceId: string, source: string, dedupKey: string): Promise<ClaimAutomationIdempotencyKeyResult> {
  const supabase = createAutomationServiceRoleClient();
  if (!supabase) {
    getLogger().error("Automation idempotency claim: service-role credential is not configured", { workspaceId, source });
    return { success: false, error: SERVICE_ROLE_UNAVAILABLE_ERROR };
  }

  const { data, error } = await supabase.rpc("claim_automation_idempotency_key", {
    p_workspace_id: workspaceId,
    p_source: source,
    p_dedup_key: dedupKey,
  });
  if (error) {
    getLogger().error("Automation idempotency claim failed", { workspaceId, source, error: error.message });
    return { success: false, error: "Could not claim this event for processing." };
  }

  const rows = (data ?? []) as AutomationIdempotencyKeyRow[];
  if (rows.length === 0) return { success: true, claimed: false };
  return { success: true, claimed: true, key: mapRow(rows[0]) };
}

export type CompleteAutomationIdempotencyKeyResult = { success: true; key: AutomationIdempotencyKey } | { success: false; error: string };

/** Marks a claimed key terminal. A `"failed"` result is what makes the key eligible for re-claim on the provider's next redelivery. */
export async function completeAutomationIdempotencyKey(id: string, status: "completed" | "failed", executionId?: string): Promise<CompleteAutomationIdempotencyKeyResult> {
  const supabase = createAutomationServiceRoleClient();
  if (!supabase) {
    getLogger().error("Automation idempotency complete: service-role credential is not configured", { id, status });
    return { success: false, error: SERVICE_ROLE_UNAVAILABLE_ERROR };
  }

  const { data, error } = await supabase.rpc("complete_automation_idempotency_key", {
    p_id: id,
    p_status: status,
    p_execution_id: executionId ?? null,
  });
  if (error || !data) {
    getLogger().error("Automation idempotency complete failed", { id, status, error: error?.message });
    return { success: false, error: "Could not record the outcome of this event." };
  }

  return { success: true, key: mapRow(data as AutomationIdempotencyKeyRow) };
}

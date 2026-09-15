import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from "@/core/integrations/webhooks/metaWebhookVerification";
import { createMetaWebhookServiceRoleClient, resolveInstagramAccountOwnership, recordMetaWebhookEvent } from "@/core/integrations/webhooks/metaWebhookServiceRole";
import { processMetaWebhookEvent } from "@/core/integrations/webhooks/metaWebhookProcessing";
import { claimAutomationIdempotencyKey, completeAutomationIdempotencyKey } from "@/core/automation/idempotency";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

const IDEMPOTENCY_SOURCE = "meta_webhook";
const SERVICE_ROLE_UNAVAILABLE_ERROR = "Service unavailable.";

/**
 * SOCIAL-11C — the Meta/Instagram inbound webhook receiver. A pure
 * ingestion boundary: verify authenticity, resolve which workspace owns
 * the event, claim idempotency (when a workspace was resolved), durably
 * record the raw event, acknowledge receipt. SOCIAL-11E adds exactly one
 * further, minimal call after the raw event is durably recorded and
 * before idempotency completes — `processMetaWebhookEvent`
 * (`metaWebhookProcessing.ts`), which resolves/creates the domain
 * comment/conversation/message (SOCIAL-11D) and dispatches the matching
 * Automation Engine trigger (SOCIAL-11B). No Lead creation, no reply, no
 * outbound Meta call, no AI call happens anywhere in that path — see
 * `metaWebhookProcessing.ts`'s own doc comment for the full boundary.
 * Signature verification, the GET handshake, and the idempotency
 * claim/complete logic are all unchanged from SOCIAL-11C.
 *
 * A single, fixed URL — unlike `api/webhooks/stripe/[connectionId]`,
 * Meta's own webhook model subscribes one callback URL at the App level
 * for every workspace's connected account at once (see
 * `metaWebhookVerification.ts`'s own doc comment); there is no
 * per-workspace URL segment to key off, which is exactly why
 * `instagram_account_identities` (SOCIAL-11C Part 1) exists — this
 * route's own account -> workspace resolution depends on it entirely.
 *
 * No auth.uid() ever reaches this route (an external Meta request, never
 * a logged-in BloomOS session) — every read/write here goes through
 * `metaWebhookServiceRole.ts`'s own dedicated service-role client, which
 * bypasses RLS by design; `workspace_id` is never accepted from the
 * request, only ever resolved server-side from the verified payload's own
 * account id against `instagram_account_identities`.
 *
 * Resolution happens BEFORE any idempotency claim, not after:
 * `automation_idempotency_keys.workspace_id` (SOCIAL-11B) is itself
 * required, so a delivery for an account this schema doesn't recognize has
 * no workspace to claim a key under at all. Such a delivery is still
 * durably recorded (never dropped), just not deduplicated — a
 * deliberate, documented, low-stakes limitation (see the migration's own
 * CHECK constraint tying `workspace_id`/`idempotency_key_id` together),
 * not a silently-ignored gap.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const result = verifyMetaWebhookChallenge({
    mode: url.searchParams.get("hub.mode"),
    verifyToken: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });

  if (!result.verified) {
    getLogger().warn("Meta webhook verification handshake failed", { mode: url.searchParams.get("hub.mode") });
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(result.challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

interface MetaWebhookEntry {
  id?: string;
  time?: number;
  changes?: Array<{ field?: string; value?: unknown }>;
  messaging?: unknown[];
}

interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

function isMetaWebhookPayload(value: unknown): value is MetaWebhookPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.object === "string" && Array.isArray(candidate.entry);
}

/**
 * Only the first entry's own account id/event type are used to resolve
 * workspace ownership and classify the delivery — a documented
 * simplification (Meta can, rarely, batch multiple entries per delivery)
 * that never loses data: the full raw payload, every entry included, is
 * always preserved verbatim in `meta_webhook_events.payload` regardless.
 */
function classifyEntry(entry: MetaWebhookEntry | undefined): string {
  if (!entry) return "unknown";
  const field = entry.changes?.[0]?.field;
  if (typeof field === "string" && field) return field;
  if (Array.isArray(entry.messaging) && entry.messaging.length > 0) return "messaging";
  return "unknown";
}

/**
 * Meta's own webhook delivery provides no explicit delivery/event id
 * field the way Stripe's `event.id` does (GAP/REQUIREMENT — see
 * `metaWebhookVerification.ts`'s own doc comment). A content hash of the
 * exact raw, already-signature-verified body is the defensible,
 * deterministic fallback: the same redelivered body always produces the
 * same key, and this makes no assumption about any specific comment/DM/
 * message field shape this checkpoint does not process.
 */
function computeDedupKey(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!verifyMetaWebhookSignature(rawBody, signatureHeader)) {
    getLogger().warn("Meta webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }
  if (!isMetaWebhookPayload(parsed)) {
    return NextResponse.json({ error: "Unrecognized event envelope." }, { status: 400 });
  }

  const firstEntry = parsed.entry[0];
  const externalAccountId = firstEntry?.id;
  if (!externalAccountId) {
    return NextResponse.json({ error: "Missing account identifier." }, { status: 400 });
  }

  const supabase = createMetaWebhookServiceRoleClient();
  if (!supabase) {
    getLogger().error("Meta webhook: service-role credential is not configured");
    return NextResponse.json({ error: SERVICE_ROLE_UNAVAILABLE_ERROR }, { status: 503 });
  }

  const objectType = parsed.object;
  const eventType = classifyEntry(firstEntry);
  const dedupKey = computeDedupKey(rawBody);
  const payload = parsed as unknown as Record<string, unknown>;

  const resolved = await resolveInstagramAccountOwnership(supabase, externalAccountId);

  if (!resolved) {
    // No known owning workspace — durably recorded, never deduplicated
    // (see this route's own doc comment), never dropped.
    const result = await recordMetaWebhookEvent(supabase, {
      idempotencyKeyId: null,
      workspaceId: null,
      instagramAccountIdentityId: null,
      externalAccountId,
      objectType,
      eventType,
      payload,
    });
    if (!result.success) {
      getLogger().error("Meta webhook: failed to record an unresolved event", { externalAccountId, error: result.error });
      return NextResponse.json({ error: "Could not record this event." }, { status: 500 });
    }
    return NextResponse.json({ received: true, resolved: false });
  }

  const claim = await claimAutomationIdempotencyKey(resolved.workspaceId, IDEMPOTENCY_SOURCE, dedupKey);
  if (!claim.success) {
    getLogger().error("Meta webhook: idempotency claim failed", { workspaceId: resolved.workspaceId, error: claim.error });
    return NextResponse.json({ error: "Could not process this event." }, { status: 500 });
  }
  if (!claim.claimed) {
    // Already processing or already completed elsewhere — a safe no-op
    // duplicate. Acknowledge receipt; never re-record, never re-trigger
    // Meta's own retry behavior for something already accepted.
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await recordMetaWebhookEvent(supabase, {
      idempotencyKeyId: claim.key.id,
      workspaceId: resolved.workspaceId,
      instagramAccountIdentityId: resolved.instagramAccountIdentityId,
      externalAccountId,
      objectType,
      eventType,
      payload,
    });

    if (!result.success) {
      await completeAutomationIdempotencyKey(claim.key.id, "failed");
      getLogger().error("Meta webhook: failed to durably record a resolved event", { workspaceId: resolved.workspaceId, error: result.error });
      return NextResponse.json({ error: "Could not record this event." }, { status: 500 });
    }

    // SOCIAL-11E — resolve/create the domain comment/conversation/message
    // (SOCIAL-11D) and dispatch the matching Automation Engine trigger
    // (SOCIAL-11B). A benign "nothing to process" outcome never throws;
    // only a genuine processing failure does, letting this function's own
    // existing catch block below mark the delivery "failed" (retryable) —
    // unchanged from SOCIAL-11C, not a new error-handling path.
    await processMetaWebhookEvent({
      workspaceId: resolved.workspaceId,
      instagramAccountIdentityId: resolved.instagramAccountIdentityId,
      externalAccountId,
      objectType,
      entry: firstEntry,
    });

    await completeAutomationIdempotencyKey(claim.key.id, "completed");
    return NextResponse.json({ received: true, resolved: true });
  } catch (error) {
    await completeAutomationIdempotencyKey(claim.key.id, "failed").catch(() => null);
    getLogger().error("Meta webhook processing threw unexpectedly", { workspaceId: resolved.workspaceId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Could not process this event." }, { status: 500 });
  }
}

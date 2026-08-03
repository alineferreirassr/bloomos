import { NextResponse } from "next/server";
import { getConnection } from "@/core/integrations/integrationManager";
import { getStripeClientForConnection } from "@/core/integrations/providers/stripe/stripeClient";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import { resolveProviderSecret } from "@/core/integrations/credentialManager";
import { processStripeWebhookEvent } from "@/modules/integrations/stripe/webhookProcessing";
import { executeWithRetry } from "@/core/integrations/retryEngine";
import { enqueueJob, claimNextJob, completeJob, failJob } from "@/core/integrations/queueEngine";
import type { RetryPolicy } from "@/core/integrations/types";
import { getCoreAuditLogService } from "@/core/audit";
import { getLogger } from "@/core/observability/logger";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * The real Stripe inbound webhook endpoint (v2 Checkpoint 23, Step 10).
 * `{connectionId}` in the URL is what a workspace configures as their
 * webhook endpoint URL in their own Stripe Dashboard — it's how this
 * single route knows which workspace's connection (and therefore which
 * webhook signing secret) an inbound event belongs to, with zero global
 * shared secret.
 *
 * Reuses, never duplicates: signature verification is the real
 * `StripeProvider.constructVerifiedEvent` (Step 1's `WebhookProvider`
 * contract). Processing is wrapped in the shared Retry Engine
 * (`executeWithRetry`) so a transient downstream failure (e.g. the mock
 * Finance repository momentarily unavailable) gets retried with real
 * backoff before this route ever gives up. Every event — handled,
 * ignored, or failed — becomes a real Queue Engine job, so the
 * Developer Center's own Diagnostics tab (Step 18) has something real to
 * show for "Webhook Deliveries"/"Failed Events"/"Retry Queue", the exact
 * same jobs table Checkpoint 22 already built, not a second one.
 */
export async function POST(request: Request, context: { params: Promise<{ connectionId: string }> }): Promise<NextResponse> {
  const { connectionId } = await context.params;

  const connection = getConnection(connectionId);
  if (!connection || connection.provider_id !== "stripe") {
    return NextResponse.json({ error: "Unknown Stripe connection." }, { status: 404 });
  }

  const webhookSecretCredentialId = connection.config.webhook_secret_credential_id;
  if (typeof webhookSecretCredentialId !== "string" || !webhookSecretCredentialId) {
    return NextResponse.json({ error: "This connection has no webhook secret configured." }, { status: 400 });
  }
  const webhookSecret = await resolveProviderSecret(webhookSecretCredentialId);
  if (!webhookSecret) {
    return NextResponse.json({ error: "This connection's webhook secret could not be resolved." }, { status: 400 });
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const rawBody = await request.text();
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const client = await getStripeClientForConnection(connectionId);
    const provider = new StripeProvider(client);
    event = provider.constructVerifiedEvent(rawBody, signatureHeader, webhookSecret);
  } catch (error) {
    getLogger().warn("Stripe webhook signature verification failed", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // maxAttempts: 1 — the shared Retry Engine already retried inside
  // executeWithRetry below; this job is a durable *record* of the
  // outcome for Diagnostics, not itself something `claimNextJob` should
  // pick back up and retry a second time.
  const job = enqueueJob({ workspaceId: connection.workspace_id, queue: "stripe-webhooks", kind: event.type, payload: { stripeEventId: event.id }, maxAttempts: 1 });
  claimNextJob(job.queue);

  // A tight, request-cycle-scoped policy — never the full 5-attempt/60s-cap
  // background policy, since this retry happens synchronously inside the
  // HTTP response Stripe itself is waiting on (Stripe expects a 2xx within
  // ~10-20s or it starts its own redundant retries).
  const INLINE_RETRY_POLICY: RetryPolicy = { baseDelayMs: 250, maxDelayMs: 1000, maxAttempts: 2, jitter: false };

  try {
    const result = await executeWithRetry(() => processStripeWebhookEvent(connection.workspace_id, connectionId, event), INLINE_RETRY_POLICY);

    if (result.succeeded) {
      completeJob(job.id);
      await getCoreAuditLogService().recordAuditEvent(connection.workspace_id, {
        actor: "stripe-webhook",
        action: "stripe.webhook.processed",
        ownerType: "integration_connection",
        ownerId: connectionId,
        before: null,
        after: { stripe_event_id: event.id, stripe_event_type: event.type, handled: result.result?.handled ?? false, summary: result.result?.summary ?? null },
      });
      return NextResponse.json({ received: true, handled: result.result?.handled ?? false });
    }

    failJob(job.id, result.error ?? "Unknown processing error");
    await getCoreAuditLogService().recordAuditEvent(connection.workspace_id, {
      actor: "stripe-webhook",
      action: "stripe.webhook.failed",
      ownerType: "integration_connection",
      ownerId: connectionId,
      before: null,
      after: { stripe_event_id: event.id, stripe_event_type: event.type, error: result.error },
    });
    // Acknowledge receipt anyway — Stripe's own retries won't fix an internal
    // processing bug our own Retry Engine already gave up on; the durable
    // QueueJob record (now `failed`) is what a human retries from Diagnostics.
    return NextResponse.json({ received: true, handled: false, error: result.error }, { status: 200 });
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
    getLogger().error("Stripe webhook processing threw unexpectedly", { connectionId, eventId: event.id, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }
}

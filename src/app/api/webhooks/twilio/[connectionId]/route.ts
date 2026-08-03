import { NextResponse } from "next/server";
import { getConnection } from "@/core/integrations/integrationManager";
import { resolveProviderSecret } from "@/core/integrations/credentialManager";
import { TwilioProvider } from "@/core/integrations/providers/twilio/twilioProvider";
import { processGenericWebhookEvent, recordWebhookRejection } from "@/modules/integrations/webhookEventProcessing";
import { enqueueJob, claimNextJob, completeJob, failJob } from "@/core/integrations/queueEngine";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

/**
 * v2 Checkpoint 43 — the real Twilio inbound status-callback endpoint,
 * mirroring the Stripe webhook route's own shape exactly: `{connectionId}`
 * in the URL is what a workspace configures as their Status Callback URL
 * in Twilio, so this one route needs no global shared secret. Signature
 * verification is the real `TwilioProvider.verifyInboundSignature`
 * (Step 1's real HMAC-SHA1 scheme) against the connection's own stored
 * Auth Token — never a second, home-rolled check. Every inbound request
 * becomes a real Queue Engine job, the same Diagnostics-visible durable
 * record the Stripe route already established.
 */
export async function POST(request: Request, context: { params: Promise<{ connectionId: string }> }): Promise<NextResponse> {
  const { connectionId } = await context.params;

  const connection = getConnection(connectionId);
  if (!connection || connection.provider_id !== "twilio") {
    return NextResponse.json({ error: "Unknown Twilio connection." }, { status: 404 });
  }
  if (!connection.credential_id) {
    return NextResponse.json({ error: "This connection has no credential configured." }, { status: 400 });
  }

  const secret = await resolveProviderSecret(connection.credential_id);
  const [accountSid, authToken] = secret?.split(":") ?? [];
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "This connection's credential could not be resolved." }, { status: 400 });
  }

  const signatureHeader = request.headers.get("x-twilio-signature");
  const rawBody = await request.text();
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing X-Twilio-Signature header." }, { status: 400 });
  }

  const provider = new TwilioProvider(accountSid, authToken, "");
  if (!provider.verifyInboundSignature({ rawBody, signatureHeader, secret: authToken })) {
    getLogger().warn("Twilio webhook signature verification failed", { connectionId });
    await recordWebhookRejection({ workspaceId: connection.workspace_id, connectionId, providerId: "twilio", reason: "Invalid signature." });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const params = new URLSearchParams(rawBody);
  const messageStatus = params.get("MessageStatus") ?? "unknown";
  const mapped = provider.mapInboundEvent(messageStatus);

  const job = enqueueJob({ workspaceId: connection.workspace_id, queue: "twilio-webhooks", kind: messageStatus, payload: { messageSid: params.get("MessageSid") }, maxAttempts: 1 });
  claimNextJob(job.queue);

  try {
    const result = await processGenericWebhookEvent({ workspaceId: connection.workspace_id, connectionId, providerId: "twilio", providerEventName: messageStatus, mappedEventType: mapped, rawPayload: { messageSid: params.get("MessageSid"), to: params.get("To") } });
    completeJob(job.id);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
    getLogger().error("Twilio webhook processing threw unexpectedly", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }
}

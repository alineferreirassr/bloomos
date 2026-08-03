import { NextResponse } from "next/server";
import { getConnection } from "@/core/integrations/integrationManager";
import { resolveProviderSecret } from "@/core/integrations/credentialManager";
import { DocuSignProvider } from "@/core/integrations/providers/docusign/docusignProvider";
import { processGenericWebhookEvent, recordWebhookRejection } from "@/modules/integrations/webhookEventProcessing";
import { enqueueJob, claimNextJob, completeJob, failJob } from "@/core/integrations/queueEngine";
import { getLogger } from "@/core/observability/logger";

export const dynamic = "force-dynamic";

/**
 * v2 Checkpoint 43 — the real DocuSign Connect inbound endpoint, same
 * shape as the Stripe/Twilio routes. The Connect HMAC secret is a
 * separate `webhook_secret_credential_id` (set via
 * `setDocuSignWebhookSecretAction`), distinct from the connection's own
 * OAuth access token — DocuSign's real Connect signing scheme
 * (`X-DocuSign-Signature-1`, HMAC-SHA256) is what
 * `DocuSignProvider.verifyInboundSignature` implements.
 */
export async function POST(request: Request, context: { params: Promise<{ connectionId: string }> }): Promise<NextResponse> {
  const { connectionId } = await context.params;

  const connection = getConnection(connectionId);
  if (!connection || connection.provider_id !== "docusign") {
    return NextResponse.json({ error: "Unknown DocuSign connection." }, { status: 404 });
  }

  const webhookSecretCredentialId = connection.config.webhook_secret_credential_id;
  if (typeof webhookSecretCredentialId !== "string" || !webhookSecretCredentialId) {
    return NextResponse.json({ error: "This connection has no webhook secret configured." }, { status: 400 });
  }
  const webhookSecret = await resolveProviderSecret(webhookSecretCredentialId);
  if (!webhookSecret) {
    return NextResponse.json({ error: "This connection's webhook secret could not be resolved." }, { status: 400 });
  }

  const signatureHeader = request.headers.get("x-docusign-signature-1");
  const rawBody = await request.text();
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing X-DocuSign-Signature-1 header." }, { status: 400 });
  }

  const provider = new DocuSignProvider("", "", "");
  if (!provider.verifyInboundSignature({ rawBody, signatureHeader, secret: webhookSecret })) {
    getLogger().warn("DocuSign webhook signature verification failed", { connectionId });
    await recordWebhookRejection({ workspaceId: connection.workspace_id, connectionId, providerId: "docusign", reason: "Invalid signature." });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: { event?: string; envelopeId?: string };
  try {
    event = JSON.parse(rawBody) as { event?: string; envelopeId?: string };
  } catch {
    return NextResponse.json({ error: "Malformed JSON body." }, { status: 400 });
  }

  const eventName = event.event ?? "unknown";
  const mapped = provider.mapInboundEvent(eventName);

  const job = enqueueJob({ workspaceId: connection.workspace_id, queue: "docusign-webhooks", kind: eventName, payload: { envelopeId: event.envelopeId }, maxAttempts: 1 });
  claimNextJob(job.queue);

  try {
    const result = await processGenericWebhookEvent({ workspaceId: connection.workspace_id, connectionId, providerId: "docusign", providerEventName: eventName, mappedEventType: mapped, rawPayload: { envelopeId: event.envelopeId } });
    completeJob(job.id);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
    getLogger().error("DocuSign webhook processing threw unexpectedly", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }
}

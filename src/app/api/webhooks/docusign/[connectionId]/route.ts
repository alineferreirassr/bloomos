import { NextResponse } from "next/server";
import { DocuSignProvider } from "@/core/integrations/providers/docusign/docusignProvider";
import {
  resolveDocuSignWebhookContext,
  reconcileVerifiedDocuSignEnvelope,
  type DocuSignWebhookContext,
  type MappedReconciliationStatus,
} from "@/core/integrations/providers/docusign/trustedReconciliation";
import { processGenericWebhookEvent, recordWebhookRejection } from "@/modules/integrations/webhookEventProcessing";
import { recordConnectionAuditEvent } from "@/core/integrations/auditCenter";
import { publishIntegrationEvent } from "@/core/integrations/eventBus";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { enqueueJob, claimNextJob, completeJob, failJob } from "@/core/integrations/queueEngine";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import type { IntegrationEventType } from "@/core/integrations/types";
import type { AutomationTriggerType } from "@/types/automation";

export const dynamic = "force-dynamic";

/**
 * v2 Checkpoint 43 / CONTRACTS-03B — the real DocuSign Connect inbound
 * endpoint, same shape as the Stripe/Twilio routes. The Connect HMAC
 * secret is a separate `webhook_secret_credential_id` (set via
 * `setDocuSignWebhookSecretAction`), distinct from the connection's own
 * OAuth access token — DocuSign's real Connect signing scheme
 * (`X-DocuSign-Signature-1`, HMAC-SHA256) is what
 * `DocuSignProvider.verifyInboundSignature` implements.
 *
 * CONTRACTS-03B: connection + credential resolution now goes through
 * `resolveDocuSignWebhookContext` (the narrow, DocuSign-only service-role
 * boundary) instead of the ordinary session-gated repository — an inbound
 * webhook has no browser session, and the required re-audit for this
 * checkpoint found that without this, the route could never even reach
 * its own HMAC verification step in a real Supabase deployment. For a
 * webhook event that maps to a real signature outcome
 * (`signature.completed`/`signature.declined`), the route now re-polls
 * DocuSign's own API for the authoritative envelope status (the webhook
 * body's own claimed status is never trusted directly) and hands only
 * that to the one privileged reconciliation RPC — everything else
 * (unmapped events, or a mapped event with no envelopeId) keeps using the
 * exact same generic path this route always has.
 */

function systemAutomationContext(): Parameters<typeof dispatchAutomationTrigger>[1] {
  return { workspaceName: null, userId: null, userName: null, role: null, permissions: [] };
}

function toReconciliationStatus(mapped: string | null): MappedReconciliationStatus | null {
  if (mapped === "signature.completed") return "signed";
  if (mapped === "signature.declined") return "declined";
  return null;
}

export async function POST(request: Request, context: { params: Promise<{ connectionId: string }> }): Promise<NextResponse> {
  const { connectionId } = await context.params;

  const ctx = await resolveDocuSignWebhookContext(connectionId);
  if (!ctx) {
    return NextResponse.json({ error: "Unknown DocuSign connection." }, { status: 404 });
  }

  const signatureHeader = request.headers.get("x-docusign-signature-1");
  const rawBody = await request.text();
  if (!signatureHeader) {
    return NextResponse.json({ error: "Missing X-DocuSign-Signature-1 header." }, { status: 400 });
  }

  const provider = new DocuSignProvider("", "", "");
  if (!provider.verifyInboundSignature({ rawBody, signatureHeader, secret: ctx.webhookSecret })) {
    getLogger().warn("DocuSign webhook signature verification failed", { connectionId });
    await recordWebhookRejection({ workspaceId: ctx.workspaceId, connectionId, providerId: "docusign", reason: "Invalid signature." });
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
  const wantsReconciliation = toReconciliationStatus(mapped) !== null;

  const job = enqueueJob({ workspaceId: ctx.workspaceId, queue: "docusign-webhooks", kind: eventName, payload: { envelopeId: event.envelopeId }, maxAttempts: 1 });
  claimNextJob(job.queue);

  try {
    if (wantsReconciliation && event.envelopeId) {
      const handled = await reconcileEnvelope(ctx, event.envelopeId, eventName, mapped);
      completeJob(job.id);
      return NextResponse.json({ received: true, handled });
    }

    const result = await processGenericWebhookEvent({
      workspaceId: ctx.workspaceId,
      connectionId,
      providerId: "docusign",
      providerEventName: eventName,
      mappedEventType: mapped,
      rawPayload: { envelopeId: event.envelopeId },
    });
    completeJob(job.id);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    failJob(job.id, error instanceof Error ? error.message : "Unknown error");
    getLogger().error("DocuSign webhook processing threw unexpectedly", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ received: true, handled: false }, { status: 200 });
  }
}

async function reconcileEnvelope(ctx: DocuSignWebhookContext, envelopeId: string, providerEventName: string, mappedEventType: string | null): Promise<boolean> {
  await recordConnectionAuditEvent(ctx.workspaceId, "docusign-webhook", "docusign.webhook.received", ctx.connectionId, null, { provider_event_name: providerEventName, mapped: mappedEventType });

  if (!ctx.accessToken || !ctx.accountId || !ctx.accountBaseUri) {
    getLogger().warn("DocuSign webhook: connection has no usable OAuth credential, cannot re-poll", { connectionId: ctx.connectionId });
    return false;
  }

  let terminalStatus: MappedReconciliationStatus | null;
  try {
    const provider = new DocuSignProvider(ctx.accessToken, ctx.accountId, ctx.accountBaseUri);
    const remote = await provider.getSignatureStatus(envelopeId);
    terminalStatus = remote.status === "signed" ? "signed" : remote.status === "declined" || remote.status === "cancelled" ? "declined" : null;
  } catch (error) {
    getLogger().error("DocuSign webhook: envelope re-poll failed", { connectionId: ctx.connectionId, error: error instanceof Error ? error.message : "Unknown error" });
    return false;
  }

  // Transient/non-terminal re-poll result (sent, viewed, partially_signed,
  // expired) — never mutates the Contract, same as the polling action's
  // own behavior. The webhook body's own claimed status was only ever used
  // to decide whether to re-poll at all, never trusted directly.
  if (!terminalStatus) return false;

  const result = await reconcileVerifiedDocuSignEnvelope({ connectionId: ctx.connectionId, envelopeId, mappedStatus: terminalStatus });
  if (!result.mutated || !result.workspaceId || !result.contractId) return result.mutated;

  const facts = { contractId: result.contractId, clientId: result.clientId };
  const genericTriggerType = (terminalStatus === "signed" ? "signature.completed" : "signature.declined") as IntegrationEventType & AutomationTriggerType;

  publishIntegrationEvent({ workspaceId: result.workspaceId, type: genericTriggerType, payload: { connectionId: ctx.connectionId, providerId: "docusign", envelopeId, ...facts } });
  await dispatchAutomationTrigger(
    { type: genericTriggerType, workspaceId: result.workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
    systemAutomationContext(),
  );

  if (terminalStatus === "signed") {
    // The one owner of contract.signed for this path — never dispatched a second time by
    // processGenericWebhookEvent, since a reconciliation-eligible event never falls through to it.
    await dispatchAutomationTrigger(
      { type: "contract.signed", workspaceId: result.workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
      systemAutomationContext(),
    );
  }
  // No contract.declined dispatch — markDeclined() itself has no such trigger today either.

  return true;
}

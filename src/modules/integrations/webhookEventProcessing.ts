import { publishIntegrationEvent } from "@/core/integrations/eventBus";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";
import { recordConnectionAuditEvent } from "@/core/integrations/auditCenter";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { insertErrorRecord } from "@/lib/data/core/integrations/errorRecordStore";
import { clockNow } from "@/core/time/clock";
import type { IntegrationEventType } from "@/core/integrations/types";
import type { AutomationTriggerType } from "@/types/automation";

/**
 * v2 Checkpoint 43 — the shared, provider-agnostic body every new
 * inbound webhook route (Twilio, DocuSign) calls after its own signature
 * verification passes. Stripe's route keeps its own bespoke
 * `processStripeWebhookEvent` (real Finance reconciliation, item-specific
 * to Payments); the providers this checkpoint adds have no equivalent
 * "internal record to reconcile" — an SMS delivery receipt or a signature
 * completion doesn't update a BloomOS entity by itself, it only needs to
 * become a real internal event other systems (Workflow triggers,
 * Timeline) can react to. This function is that one generic path, so a
 * third new webhook-emitting provider never needs a fourth bespoke
 * processing function.
 *
 * `mappedEventType` is the same closed-enum string in both the Event Bus's
 * `IntegrationEventType` and Automation's `AutomationTriggerType` — every
 * value this checkpoint adds (`sms.delivered`, `signature.completed`, etc.)
 * is a member of both, by construction (see `types.ts`/`types/automation.ts`).
 */
export async function processGenericWebhookEvent(params: { workspaceId: string; connectionId: string; providerId: string; providerEventName: string; mappedEventType: string | null; rawPayload: Record<string, unknown> }): Promise<{ handled: boolean }> {
  await recordConnectionAuditEvent(params.workspaceId, `${params.providerId}-webhook`, `${params.providerId}.webhook.received`, params.connectionId, null, { provider_event_name: params.providerEventName, mapped: params.mappedEventType });

  if (!params.mappedEventType) return { handled: false };

  const eventType = params.mappedEventType as IntegrationEventType;
  const triggerType = params.mappedEventType as AutomationTriggerType;
  const facts = { connectionId: params.connectionId, providerId: params.providerId };

  publishIntegrationEvent({ workspaceId: params.workspaceId, type: eventType, payload: { ...facts, ...params.rawPayload } });
  await dispatchAutomationTrigger(
    { type: triggerType, workspaceId: params.workspaceId, occurredAt: clockNow().toISOString(), actorMemberId: null, facts },
    { workspaceName: null, userId: null, userName: null, role: null, permissions: [] },
  );
  return { handled: true };
}

export async function recordWebhookRejection(params: { workspaceId: string; connectionId: string; providerId: string; reason: string }): Promise<void> {
  const record = sanitizeIntegrationError({ connectionId: params.connectionId, providerId: params.providerId, rawMessage: params.reason });
  insertErrorRecord(record);
  await recordConnectionAuditEvent(params.workspaceId, `${params.providerId}-webhook`, `${params.providerId}.webhook.rejected`, params.connectionId, null, { reason: record.message });
}

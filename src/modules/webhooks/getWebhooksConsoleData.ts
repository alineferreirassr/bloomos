"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { listWebhookEndpointsForWorkspace, toPublicWebhookEndpoint } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { listWebhookDeliveriesForWorkspace, summarizeWebhookDeliveries } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { listWebhookEvents } from "@/core/webhooks/eventRegistry";
import { registerBuiltinWebhookEvents } from "@/modules/webhooks/registerBuiltinWebhookEvents";
import type { PublicWebhookEndpoint } from "@/types/webhookEndpoint";
import type { WebhookDelivery, WebhookDeliverySummary } from "@/types/webhookDelivery";
import type { WebhookEventDefinition } from "@/types/webhookEvent";

const GENERIC_ACCESS_ERROR = "The Developer Console isn't available. You may not have access to it.";

registerBuiltinWebhookEvents();

export interface WebhooksConsoleData {
  endpoints: PublicWebhookEndpoint[];
  deliveries: WebhookDelivery[];
  summary: WebhookDeliverySummary;
  catalog: WebhookEventDefinition[];
}

export type GetWebhooksConsoleDataResult = { success: true; data: WebhooksConsoleData } | { success: false; error: string };

/** Checkpoint 17, Step 9 — the one aggregate the Developer Console's Webhooks/Deliveries tabs read from, mirroring `getDeveloperConsoleData.ts`'s own "one aggregate, computed fresh" shape. */
export async function getWebhooksConsoleData(): Promise<GetWebhooksConsoleDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  return {
    success: true,
    data: {
      endpoints: listWebhookEndpointsForWorkspace(session.workspace.id).map(toPublicWebhookEndpoint),
      deliveries: listWebhookDeliveriesForWorkspace(session.workspace.id),
      summary: summarizeWebhookDeliveries(session.workspace.id),
      catalog: listWebhookEvents(),
    },
  };
}

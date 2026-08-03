"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  createWebhookEndpoint,
  listWebhookEndpointsForWorkspace,
  getWebhookEndpointById,
  rotateWebhookEndpointSecret,
  setWebhookEndpointStatus,
  toPublicWebhookEndpoint,
} from "@/lib/data/core/webhooks/webhookEndpointStore";
import { deliverWithRetry } from "@/core/webhooks/retryEngine";
import { buildTestWebhookEventEnvelope } from "@/core/webhooks/payloadBuilder";
import { getLogger } from "@/core/observability/logger";
import type { PublicWebhookEndpoint, WebhookEndpointWithSecret, CreateWebhookEndpointInput, WebhookEndpointStatus } from "@/types/webhookEndpoint";

const GENERIC_ACCESS_ERROR = "The Developer Console isn't available. You may not have access to it.";

export type ManageWebhookEndpointsResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Checkpoint 17, Step 9/11 — every Webhook Endpoint mutation funnels
 * through this one file, mirroring `manageApiKeysActions.ts`'s own shape
 * exactly: each action independently re-checks `workspace.manage`
 * (Step 11's own "Developer/Admin only" — the same elevated permission
 * `/settings` and the API Keys tab already require), returns the same
 * `{success,data}|{success,error}` envelope, and logs via `getLogger()`.
 */

export async function listWebhookEndpointsAction(): Promise<ManageWebhookEndpointsResult<PublicWebhookEndpoint[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: listWebhookEndpointsForWorkspace(session.workspace.id).map(toPublicWebhookEndpoint) };
}

export async function createWebhookEndpointAction(input: CreateWebhookEndpointInput): Promise<ManageWebhookEndpointsResult<WebhookEndpointWithSecret>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmedUrl = input.url.trim();
  if (!trimmedUrl) return { success: false, error: "Enter a URL to deliver events to." };
  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    return { success: false, error: "Enter a valid URL, including https://." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { success: false, error: "The URL must use http:// or https://." };
  if (input.subscribed_events.length === 0) return { success: false, error: "Select at least one event." };

  const result = await createWebhookEndpoint(session.workspace.id, session.membership.id, { ...input, url: trimmedUrl });
  getLogger().info("Webhook Endpoint created", { workspaceId: session.workspace.id, endpointId: result.endpoint.id, eventCount: input.subscribed_events.length });
  return { success: true, data: result };
}

async function requireOwnedEndpoint(id: string): Promise<{ success: true; workspaceId: string } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = getWebhookEndpointById(id);
  if (!existing || existing.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, workspaceId: session.workspace.id };
}

export async function rotateWebhookEndpointSecretAction(id: string): Promise<ManageWebhookEndpointsResult<WebhookEndpointWithSecret>> {
  const gate = await requireOwnedEndpoint(id);
  if (!gate.success) return gate;

  const result = rotateWebhookEndpointSecret(id);
  if (!result) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Webhook Endpoint secret rotated", { workspaceId: gate.workspaceId, endpointId: id });
  return { success: true, data: result };
}

export async function setWebhookEndpointStatusAction(id: string, status: WebhookEndpointStatus): Promise<ManageWebhookEndpointsResult<PublicWebhookEndpoint>> {
  const gate = await requireOwnedEndpoint(id);
  if (!gate.success) return gate;

  const updated = setWebhookEndpointStatus(id, status);
  if (!updated) return { success: false, error: GENERIC_ACCESS_ERROR };
  getLogger().info("Webhook Endpoint status changed", { workspaceId: gate.workspaceId, endpointId: id, status });
  return { success: true, data: toPublicWebhookEndpoint(updated) };
}

/** Step 9's own "Test delivery" — sends a synthetic `webhook.test` ping through the exact same Dispatcher/Retry Engine every real event uses, so a member can confirm their endpoint actually receives and verifies BloomOS's signature before subscribing it to real traffic. */
export async function testWebhookEndpointDeliveryAction(id: string): Promise<ManageWebhookEndpointsResult<{ deliveryId: string }>> {
  const gate = await requireOwnedEndpoint(id);
  if (!gate.success) return gate;

  const endpoint = getWebhookEndpointById(id);
  if (!endpoint) return { success: false, error: GENERIC_ACCESS_ERROR };

  const envelope = buildTestWebhookEventEnvelope(gate.workspaceId);
  const delivery = await deliverWithRetry({ endpoint, envelope, body: JSON.stringify(envelope), isTest: true });
  return { success: true, data: { deliveryId: delivery.id } };
}

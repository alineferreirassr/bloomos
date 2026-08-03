import { generateId, nowIso } from "@/lib/data/utils";
import { generateWebhookSecret, displayPrefix } from "@/lib/webhooks/webhookSecret";
import type { WebhookEndpoint, WebhookEndpointStatus, WebhookEndpointWithSecret, CreateWebhookEndpointInput, PublicWebhookEndpoint } from "@/types/webhookEndpoint";

/**
 * Checkpoint 17 — the Webhook Endpoint store. Mock-only, unconditionally,
 * regardless of `NEXT_PUBLIC_DATA_MODE` — the same "new checkpoint
 * domain, mock-only this phase" precedent every brand-new domain since
 * Checkpoint 13 has followed (see `apiKeyStore.ts`'s own doc comment). A
 * plain top-level `let` (not `getGlobalMockStore`) is safe here — unlike
 * Checkpoint 16's API Keys, nothing in this checkpoint reads or writes
 * Webhook Endpoints from a Route Handler; every touch point is a Server
 * Action reached from the Developer Console, all compiled into the same
 * module graph.
 */
let endpoints: WebhookEndpoint[] = [];

export function resetWebhookEndpointStore(): void {
  endpoints = [];
}

export function toPublicWebhookEndpoint(endpoint: WebhookEndpoint): PublicWebhookEndpoint {
  const { secret: _secret, ...rest } = endpoint;
  return rest;
}

export async function createWebhookEndpoint(workspaceId: string, createdBy: string, input: CreateWebhookEndpointInput): Promise<WebhookEndpointWithSecret> {
  const secret = generateWebhookSecret();
  const now = nowIso();
  const endpoint: WebhookEndpoint = {
    id: generateId("webhook-endpoint"),
    workspace_id: workspaceId,
    url: input.url,
    description: input.description.trim().length > 0 ? input.description.trim() : null,
    secret,
    secret_prefix: displayPrefix(secret),
    subscribed_events: input.subscribed_events,
    status: "enabled",
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    rotated_at: null,
    last_delivery_at: null,
    last_delivery_status: null,
  };
  endpoints = [...endpoints, endpoint];
  return { endpoint: toPublicWebhookEndpoint(endpoint), secret };
}

export function listWebhookEndpointsForWorkspace(workspaceId: string): WebhookEndpoint[] {
  return endpoints.filter((endpoint) => endpoint.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getWebhookEndpointById(id: string): WebhookEndpoint | null {
  return endpoints.find((endpoint) => endpoint.id === id) ?? null;
}

function updateEndpoint(id: string, patch: Partial<WebhookEndpoint>): WebhookEndpoint | null {
  const existing = getWebhookEndpointById(id);
  if (!existing) return null;
  const updated: WebhookEndpoint = { ...existing, ...patch, updated_at: nowIso() };
  endpoints = endpoints.map((endpoint) => (endpoint.id === id ? updated : endpoint));
  return updated;
}

/** Replaces the endpoint's own secret in place (same id/url/description/subscriptions/history) — the old secret stops verifying immediately, but delivery history is never lost, distinct from disabling. */
export function rotateWebhookEndpointSecret(id: string): WebhookEndpointWithSecret | null {
  const secret = generateWebhookSecret();
  const updated = updateEndpoint(id, { secret, secret_prefix: displayPrefix(secret), rotated_at: nowIso() });
  if (!updated) return null;
  return { endpoint: toPublicWebhookEndpoint(updated), secret };
}

export function setWebhookEndpointStatus(id: string, status: WebhookEndpointStatus): WebhookEndpoint | null {
  return updateEndpoint(id, { status });
}

export function touchWebhookEndpointLastDelivery(id: string, status: "success" | "failed"): void {
  updateEndpoint(id, { last_delivery_at: nowIso(), last_delivery_status: status });
}

"use server";

import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { clockNow } from "@/core/time/clock";

/**
 * Checkpoint 17 — a dedicated `"use server"` wrapper purely so
 * `portal.login` can publish safely. `ClientAccessLandingView.tsx` (the
 * caller) is a `"use client"` component that already calls
 * `updateClientLastAccess()`/`logClientPortalActivityForCurrentSession()`
 * directly against the browser-safe `@/lib/data` facade — but
 * `publishWebhookEvent` reads the server-side Webhook Endpoint store and
 * performs a real outbound `fetch()` with a signing secret that must never
 * reach the browser, so it can't be called inline from that component the
 * same way. This one-function file is the entire fix: everything else
 * about the login flow is unchanged.
 */
export async function publishPortalLoginWebhookEvent(workspaceId: string, clientAccountId: string, clientId: string): Promise<void> {
  publishWebhookEvent({
    type: "portal.login",
    workspaceId,
    resource: { type: "client_account", id: clientAccountId },
    payload: { client_account_id: clientAccountId, client_id: clientId, occurred_at: clockNow().toISOString() },
  });
}

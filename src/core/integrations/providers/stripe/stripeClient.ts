import Stripe from "stripe";
import { getConnection, listConnections } from "@/core/integrations/integrationManager";
import { resolveProviderSecret } from "@/core/integrations/credentialManager";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import { withApiCallLogging } from "@/core/integrations/providers/stripe/stripeApiCallLog";
import type { IntegrationConnection } from "@/core/integrations/types";

/**
 * v2 Checkpoint 23 — the one place a real `Stripe` SDK client instance is
 * constructed. Never called with a hardcoded or fabricated key: the
 * secret always comes from `resolveProviderSecret()`, which decrypts a
 * `provider_secret`-kind `IntegrationCredential` the workspace itself
 * pasted into the Configuration Center. No `apiVersion` is pinned here —
 * omitting it lets the installed SDK version use its own bundled
 * default, so this file never drifts out of sync with `package.json`.
 */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { appInfo: { name: "BloomOS", version: "1.0.0" } });
}

export class StripeConnectionNotReadyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StripeConnectionNotReadyError";
  }
}

/**
 * Resolves a real, ready-to-use `Stripe` client for a given connection —
 * the one function every Stripe-calling Server Action uses instead of
 * constructing its own client. Throws a typed, user-safe error (never
 * the raw secret) if the connection has no attached credential or the
 * credential can't be resolved.
 */
export async function getStripeClientForConnection(connectionId: string): Promise<Stripe> {
  const connection = getConnection(connectionId);
  if (!connection) throw new StripeConnectionNotReadyError("No connection found for this Stripe integration.");
  if (connection.state !== "connected") throw new StripeConnectionNotReadyError(`This Stripe connection is "${connection.state}", not connected — real payment operations are blocked until it's reconnected.`);
  if (!connection.credential_id) throw new StripeConnectionNotReadyError("This Stripe connection has no credential attached yet.");

  const secret = await resolveProviderSecret(connection.credential_id);
  if (!secret) throw new StripeConnectionNotReadyError("This Stripe connection's credential could not be resolved — it may have been revoked.");

  return createStripeClient(secret);
}

/** Reads the `mode` (`sandbox`/`production`) a connection was configured with — stored on `IntegrationConnection.config`, the exact "declared by the provider's own configSchema-equivalent" slot Checkpoint 22 designed for this. */
export function getStripeConnectionMode(connectionId: string): "sandbox" | "production" | null {
  const connection = getConnection(connectionId);
  const mode = connection?.config.mode;
  return mode === "sandbox" || mode === "production" ? mode : null;
}

/** A workspace has at most one Stripe connection — every Customer/Product/Checkout/Invoice/Refund operation resolves it this same way, never a hardcoded id. */
export function getStripeConnectionForWorkspace(workspaceId: string): IntegrationConnection | null {
  return listConnections(workspaceId).find((connection) => connection.provider_id === "stripe") ?? null;
}

/** The one function every real Stripe operation (Customers, Products, Checkout, Invoices, Refunds) uses to get a ready `StripeProvider` — resolves the connection, checks it's actually `connected`, decrypts the credential, and wraps it. Never called with a workspace that has no connected Stripe integration. */
export async function getStripeProviderForWorkspace(workspaceId: string): Promise<StripeProvider> {
  const connection = getStripeConnectionForWorkspace(workspaceId);
  if (!connection) throw new StripeConnectionNotReadyError("This workspace has no Stripe connection yet.");
  const client = await getStripeClientForConnection(connection.id);
  return withApiCallLogging(workspaceId, new StripeProvider(client));
}

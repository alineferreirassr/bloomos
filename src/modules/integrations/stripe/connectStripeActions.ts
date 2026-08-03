"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { registerStripeProviderFactory } from "@/modules/integrations/stripe/registerStripeProviderFactory";
import { applyConnectionEvent, attachCredential, getConnection, installProvider, listConnections, setConnectionConfig } from "@/core/integrations/integrationManager";
import { issueProviderSecretCredential, rotateProviderSecretCredential, resolveProviderSecret } from "@/core/integrations/credentialManager";
import { createStripeClient } from "@/core/integrations/providers/stripe/stripeClient";
import { StripeProvider } from "@/core/integrations/providers/stripe/stripeProvider";
import { getLogger } from "@/core/observability/logger";
import type { IntegrationConnection } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "The Stripe connection isn't available. You may not have access to it.";

registerBuiltinProviders();
registerStripeProviderFactory();

export type StripeMode = "sandbox" | "production";

export type ManageStripeConnectionResult<T> = { success: true; data: T } | { success: false; error: string };

/** A workspace has at most one Stripe connection — this is the one place every Stripe Server Action finds (or lazily creates, still `disconnected`) it. */
function getOrInstallStripeConnectionSync(workspaceId: string): IntegrationConnection | null {
  return listConnections(workspaceId).find((connection) => connection.provider_id === "stripe") ?? null;
}

async function getOrInstallStripeConnection(workspaceId: string, installedBy: string): Promise<IntegrationConnection> {
  const existing = getOrInstallStripeConnectionSync(workspaceId);
  if (existing) return existing;
  return installProvider({ workspaceId, providerId: "stripe", installedBy });
}

function validateSecretMatchesMode(secret: string, mode: StripeMode): string | null {
  const looksLikeTest = secret.startsWith("sk_test_") || secret.startsWith("rk_test_");
  const looksLikeLive = secret.startsWith("sk_live_") || secret.startsWith("rk_live_");
  if (!looksLikeTest && !looksLikeLive) return 'That doesn\'t look like a real Stripe secret key — it should start with "sk_test_", "sk_live_", "rk_test_", or "rk_live_".';
  if (mode === "sandbox" && looksLikeLive) return 'You selected Sandbox, but this looks like a live/production key ("sk_live_"/"rk_live_"). Use a test-mode key, or switch the mode to Production.';
  if (mode === "production" && looksLikeTest) return 'You selected Production, but this looks like a test-mode key ("sk_test_"/"rk_test_"). Use a live key, or switch the mode to Sandbox.';
  return null;
}

export interface StripeConnectionSummary {
  connection: IntegrationConnection | null;
  mode: StripeMode | null;
}

export async function getStripeConnectionAction(): Promise<ManageStripeConnectionResult<StripeConnectionSummary>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getOrInstallStripeConnectionSync(session.workspace.id);
  const mode = connection?.config.mode;
  return { success: true, data: { connection, mode: mode === "sandbox" || mode === "production" ? mode : null } };
}

/**
 * v2 Checkpoint 23, Step 2 — the real Connection Flow. Never transitions
 * the Connection State Machine to `connected` on faith: the pasted
 * secret is tested with a genuine Stripe API call (`ping()` →
 * `balance.retrieve()`) *before* it's ever persisted, and *before*
 * `connect_succeeded` fires. A key that fails the real test is never
 * stored — `issueProviderSecretCredential` only runs after the test
 * passes.
 */
export async function connectStripeAction(secret: string, mode: StripeMode): Promise<ManageStripeConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmedSecret = secret.trim();
  const modeError = validateSecretMatchesMode(trimmedSecret, mode);
  if (modeError) return { success: false, error: modeError };

  const provider = new StripeProvider(createStripeClient(trimmedSecret));
  const testResult = await provider.ping();
  if (!testResult.ok) {
    getLogger().warn("Stripe connection test failed", { workspaceId: session.workspace.id, error: testResult.error });
    return { success: false, error: `Stripe rejected this key: ${testResult.error ?? "unknown error"}.` };
  }

  const connection = await getOrInstallStripeConnection(session.workspace.id, session.membership.id);
  setConnectionConfig(connection.id, { mode });

  let withCredential = connection;
  if (connection.credential_id) {
    const rotated = await rotateProviderSecretCredential(connection.credential_id, trimmedSecret);
    if (!rotated) return { success: false, error: "Could not update the existing Stripe credential." };
  } else {
    const credential = await issueProviderSecretCredential({ workspaceId: session.workspace.id, connectionId: connection.id, createdBy: session.membership.id, secret: trimmedSecret });
    const updated = attachCredential(connection.id, credential.id);
    if (!updated) return { success: false, error: "Could not attach the new Stripe credential to this connection." };
    withCredential = updated;
  }

  // Walk the real Connection State Machine: from wherever it currently is, to connected.
  try {
    if (withCredential.state === "disabled") {
      await applyConnectionEvent(connection.id, "enable_requested", session.membership.id);
    }
    const afterEnable = getConnection(connection.id) ?? withCredential;
    if (afterEnable.state === "disconnected" || afterEnable.state === "failed") {
      await applyConnectionEvent(connection.id, afterEnable.state === "failed" ? "reconnect_requested" : "connect_requested", session.membership.id);
    }
    const result = await applyConnectionEvent(connection.id, "connect_succeeded", session.membership.id, `Verified with a real Stripe balance.retrieve() call, ${testResult.latencyMs}ms.`);
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not complete the connection." };
  }
}

/** Re-runs the real Stripe test against the connection's own already-stored credential — never asks for the secret again. */
export async function testStripeConnectionAction(connectionId: string): Promise<ManageStripeConnectionResult<{ ok: boolean; latencyMs: number; error?: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "stripe") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!connection.credential_id) return { success: false, error: "This connection has no credential yet." };

  const secret = await resolveProviderSecret(connection.credential_id);
  if (!secret) return { success: false, error: "This connection's credential could not be resolved." };

  const provider = new StripeProvider(createStripeClient(secret));
  const result = await provider.ping();

  try {
    if (result.ok && connection.state === "connected") {
      // Already connected and still healthy — nothing to transition, just report.
    } else if (result.ok) {
      await applyConnectionEvent(connectionId, "connect_succeeded", session.membership.id, `Re-tested: ${result.latencyMs}ms.`);
    } else {
      await applyConnectionEvent(connectionId, "health_check_failed", session.membership.id, result.error ?? "Health check failed.");
    }
  } catch (error) {
    getLogger().warn("Stripe connection test transition failed", { connectionId, error: error instanceof Error ? error.message : "Unknown error" });
  }

  return { success: true, data: result };
}

export async function disconnectStripeAction(connectionId: string): Promise<ManageStripeConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "stripe") return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    const result = await applyConnectionEvent(connectionId, "disable_requested", session.membership.id, "Disconnected by a workspace member.");
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not disconnect." };
  }
}

/** Re-enables a disabled connection and re-runs the real Stripe test — the same path `connectStripeAction` uses once a credential already exists, exposed as its own action so the UI's "Reconnect" button never needs to ask for the secret again. */
export async function reconnectStripeAction(connectionId: string): Promise<ManageStripeConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "stripe") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!connection.credential_id) return { success: false, error: "This connection has no credential to reconnect with — connect it with a key first." };

  const secret = await resolveProviderSecret(connection.credential_id);
  if (!secret) return { success: false, error: "This connection's credential could not be resolved." };

  const provider = new StripeProvider(createStripeClient(secret));
  const testResult = await provider.ping();
  if (!testResult.ok) return { success: false, error: `Stripe rejected the stored key: ${testResult.error ?? "unknown error"}. Reconnect with a fresh key instead.` };

  try {
    if (connection.state === "disabled") await applyConnectionEvent(connectionId, "enable_requested", session.membership.id);
    const afterEnable = getConnection(connectionId) ?? connection;
    if (afterEnable.state === "disconnected" || afterEnable.state === "failed") {
      await applyConnectionEvent(connectionId, afterEnable.state === "failed" ? "reconnect_requested" : "connect_requested", session.membership.id);
    }
    const result = await applyConnectionEvent(connectionId, "connect_succeeded", session.membership.id, `Reconnected — verified with a real Stripe call, ${testResult.latencyMs}ms.`);
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not reconnect." };
  }
}

/**
 * The webhook *signing* secret (`whsec_...`) is real Stripe secret
 * material too — a leaked one lets an attacker forge webhook payloads —
 * so it's stored exactly like the API key: encrypted via
 * `issueProviderSecretCredential`, never in `IntegrationConnection.config`
 * directly. Only its resulting credential id lives in `config`
 * (`webhook_secret_credential_id`), since `config` itself is never
 * encrypted. A workspace pastes this in after creating the real webhook
 * endpoint in their own Stripe Dashboard, pointed at
 * `/api/webhooks/stripe/{connectionId}` — see `docs/stripe-webhooks.md`.
 */
export async function setStripeWebhookSecretAction(connectionId: string, webhookSecret: string): Promise<ManageStripeConnectionResult<{ connectionId: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || connection.provider_id !== "stripe") return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmed = webhookSecret.trim();
  if (!trimmed.startsWith("whsec_")) return { success: false, error: 'A Stripe webhook signing secret starts with "whsec_".' };

  const existingCredentialId = connection.config.webhook_secret_credential_id;
  if (typeof existingCredentialId === "string" && existingCredentialId) {
    const rotated = await rotateProviderSecretCredential(existingCredentialId, trimmed);
    if (!rotated) return { success: false, error: "Could not update the existing webhook secret." };
  } else {
    const credential = await issueProviderSecretCredential({ workspaceId: session.workspace.id, connectionId, createdBy: session.membership.id, secret: trimmed });
    setConnectionConfig(connectionId, { webhook_secret_credential_id: credential.id });
  }

  return { success: true, data: { connectionId } };
}

export async function getStripeWebhookEndpointUrl(connectionId: string, appOrigin: string): Promise<string> {
  return `${appOrigin}/api/webhooks/stripe/${connectionId}`;
}
